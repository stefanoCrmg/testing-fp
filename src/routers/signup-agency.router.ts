import { ManagementClient, AuthenticationClient } from 'auth0'
import * as crypto from 'crypto'
import { pipe } from 'fp-ts/lib/function'
import * as t from 'io-ts'

import * as TE from 'fp-ts/TaskEither'

import * as C from 'fp-ts/Console'

import { readonlyNonEmptyArray } from 'io-ts-types'

import { loadEnvironment } from '../config/environment'
import { IO } from 'fp-ts/lib/IO'
import { parse } from 'csv-parse';
import fs from 'fs' 
import { exit } from 'process'

const parser = parse({columns: true}, 
  (error, records) => {
  if (error) {
    console.error('Parsing error: ', error)
    exit(-1)
  }

  
});

fs
  .createReadStream(__dirname+'/chart-of-accounts.csv')
  .pipe(parser);


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

const taskMgmt = (user: UserFromAPI): TE.TaskEither<string, unknown> => pipe(
  C.info(`${user.email}: Creating account for ${user.email}`),
  TE.fromIO,
  TE.chain(() => TE.tryCatch(
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
    (reason) => `Couldn't signup user: ${user.email} - ${reason}`)))

const taskAuth = (user: UserFromAPI): TE.TaskEither<string, void> => 
  pipe(
    C.info(`${user.email}: Sending email reset password to ${user.email}`),
    TE.fromIO,
    TE.chain(
      () => TE.tryCatch(
        () =>
          auth0AuthAPI.requestChangePasswordEmail({
            email: user.email,
            connection: 'Username-Password-Authentication',
          }),
        (reason) => `Couldn't send email reset: ${user.email} - ${reason}`)
      )
    )

const taskSignupAgency = (user: UserFromAPI): TE.TaskEither<IO<void>, IO<void>> =>
  pipe(
    taskMgmt(user),
    TE.chain(() => taskAuth(user)),
    TE.bimap(
      C.error,
      () => C.info(`${user.email} signed up`)
    ),
  )




export { createSignupAgencyRoute }
