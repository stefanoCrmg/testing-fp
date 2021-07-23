import express, { Request, Response, Router } from 'express'
import { ManagementClient, AuthenticationClient, UserMetadata, AppMetadata, User } from 'auth0'
import * as crypto from 'crypto'
import { pipe } from 'fp-ts/lib/function'
import * as t from 'io-ts'
import * as E from 'fp-ts/Either'
import * as TE from 'fp-ts/TaskEither'
import * as T from 'fp-ts/Task'
import * as RNEA from 'fp-ts/ReadonlyNonEmptyArray'
import { readonlyNonEmptyArray } from 'io-ts-types'
import { formatValidationErrors } from 'io-ts-reporters'
import { loadEnvironment } from '../config/environment'
import { PinoLogger } from '../logger-config'
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

const SignupRouteParams = readonlyNonEmptyArray(
  t.type({
    name: t.string,
    email: t.string,
    vatcode: t.string,
    roles: t.union([readonlyNonEmptyArray(t.string), t.undefined]),
  })
)

type UsersArray = t.TypeOf<typeof SignupRouteParams>
type UserFromAPI = UsersArray[0]

const UserFromAuth0 = t.type({
  name: t.string,
  email: t.string,
  user_id: t.string,
  app_metadata: t.type({ 'vat-code': t.string }),
})

const environment = loadEnvironment()
const auth0MgmtAPI = new ManagementClient({
  ...environment.auth0,
  scope: 'create:users',
})
const auth0AuthAPI = new AuthenticationClient({ ...environment.auth0 })

const taskWriteToDB = (user: User<AppMetadata, UserMetadata>) => {
  PinoLogger.logger.info(`Writing to DB`)
  return pipe(
    UserFromAuth0.decode(user),
    E.mapLeft(() => new Error(String(`User wasnt properly registered on auth0`))),
    TE.fromEither,
    TE.chain((success) =>
      TE.tryCatch(
        () =>
          prisma.agencies.create({
            data: {
              name: success.name,
              vat_code: success.app_metadata['vat-code'],
              auth0_id: success.user_id,
            },
          }),
        (reason) => new Error(String(`${success.email} - ${reason}`))
      )
    )
  )
}

const taskMgmt = (user: UserFromAPI) => {
  PinoLogger.logger.info(`${user.email}: Creating account for ${user.email}`)
  return TE.tryCatch(
    () =>
      auth0MgmtAPI.createUser({
        connection: 'Username-Password-Authentication',
        email_verified: false,
        password: crypto.randomBytes(32).toString('base64'),
        verify_email: true,
        name: user.name,
        email: user.email,
        app_metadata: {
          'vat-code': user.vatcode,
        },
      }),
    (reason) => new Error(String(`${user.email} - ${reason}`))
  )
}

const taskAuth = (user: UserFromAPI): TE.TaskEither<Error, void> => {
  PinoLogger.logger.info(`${user.email}: Sending email reset password to ${user.email}`)
  return TE.tryCatch(
    () =>
      auth0AuthAPI.requestChangePasswordEmail({
        email: user.email,
        connection: 'Username-Password-Authentication',
      }),
    (reason) => new Error(String(`${user.email} - ${reason}`))
  )
}

const taskSignupAgency = (user: UserFromAPI): TE.TaskEither<Error, UserFromAPI> =>
  pipe(
    user,
    taskMgmt,
    TE.chain(taskWriteToDB),
    TE.chain(() => taskAuth(user)),
    TE.bimap(
      (error) => {
        PinoLogger.logger.error(error.message)
        return error
      },
      () => {
        PinoLogger.logger.info('Agency registered')
        return user
      }
    )
  )

const partition = <L, R>(
  tasks: RNEA.ReadonlyNonEmptyArray<TE.TaskEither<L, R>>
): TE.TaskEither<RNEA.ReadonlyNonEmptyArray<L>, RNEA.ReadonlyNonEmptyArray<R>> => {
  return pipe(
    tasks,
    RNEA.traverse(TE.getApplicativeTaskValidation(T.ApplySeq, RNEA.getSemigroup<L>()))(TE.mapLeft(RNEA.of))
  )
}

const signupMultipleAgencies = (users: UsersArray) => pipe(users, RNEA.map(taskSignupAgency), partition)
const signupAgencies = async (req: Request, res: Response) => {
  const reqBody = SignupRouteParams.decode(req.body)
  return pipe(
    reqBody,
    E.fold(
      (failure) => {
        req.log.error(formatValidationErrors(failure))
        res.status(400).send(formatValidationErrors(failure))
      },
      (success) =>
        pipe(
          signupMultipleAgencies(success),
          TE.bimap(
            (_failure) => res.status(400).send(_failure.map((e) => e.message)),
            (success) => res.status(200).send(success)
          )
        )()
    )
  )
}

const createSignupAgencyRoute = (): Router => {
  const router = express.Router({ mergeParams: true })
  // router.use(checkJwt)
  router.post('/signup', signupAgencies)
  return router
}

export { createSignupAgencyRoute }
