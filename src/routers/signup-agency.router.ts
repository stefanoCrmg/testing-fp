import express, { Request, Response, Router } from 'express'
import { ManagementClient, AuthenticationClient } from 'auth0'
import * as crypto from 'crypto'
import { pipe } from 'fp-ts/lib/function'
import * as t from 'io-ts'
import * as E from 'fp-ts/Either'
import * as TE from 'fp-ts/TaskEither'
import * as T from 'fp-ts/Task'
import { formatValidationErrors } from 'io-ts-reporters'
import { loadEnvironment } from '../config/environment'
import { PinoLogger } from '../logger-config'

const SignupRouteParams = t.array(
  t.type({
    name: t.string,
    email: t.string,
    vatcode: t.string,
    roles: t.union([t.array(t.string), t.undefined]),
  })
)
type UsersArray = t.TypeOf<typeof SignupRouteParams>
type User = UsersArray[0]

const environment = loadEnvironment()

const auth0MgmtAPI = new ManagementClient({
  ...environment.auth0,
  scope: 'create:users',
})
const auth0AuthAPI = new AuthenticationClient({ ...environment.auth0 })

const taskMgmt = (user: User) => {
  PinoLogger.logger.info(`${user.email}: Creating account for ${user.email}`)
  return pipe(
    TE.tryCatch(
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
      (reason) => new Error(String(reason))
    )
  )
}

const taskAuth = (user: User): TE.TaskEither<Error, void> => {
  PinoLogger.logger.info(`${user.email}: Sending email reset password to ${user.email}`)
  return pipe(
    TE.tryCatch(
      () =>
        auth0AuthAPI.requestChangePasswordEmail({
          email: user.email,
          connection: 'Username-Password-Authentication',
        }),
      (reason) => new Error(String(reason))
    )
  )
}

const taskSignupAgency = (user: User) =>
  pipe(
    user,
    taskMgmt,
    TE.mapLeft((failure) => {
      PinoLogger.logger.error(`1 - ${user.email} - ${failure}`)
    }),
    TE.chain((_success) =>
      pipe(
        taskAuth(user),
        TE.bimap(
          (error) => {
            PinoLogger.logger.error(`2 - ${user.email} - ${error}`)
          },
          (_) => {
            PinoLogger.logger.info('Agency registered')
          }
        )
      )
    )
  )

const signupMultipleAgencies = (users: UsersArray) =>
  pipe(
    users.map((user) => taskSignupAgency(user)),
    T.sequenceArray
  )()

const signupAgencies = async (req: Request, res: Response) => {
  const reqBody = SignupRouteParams.decode(req.body)
  pipe(
    reqBody,
    E.fold(
      (failure) => {
        req.log.error(formatValidationErrors(failure))
        res.status(400).send(formatValidationErrors(failure))
      },
      (success) => {
        req.log.info('Buono')
        signupMultipleAgencies(success)
      }
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
