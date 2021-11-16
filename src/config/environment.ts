import { pipe } from 'fp-ts/lib/function'
import { ManagementClient, AuthenticationClient } from 'auth0'
import * as t from 'io-ts'
import * as E from 'fp-ts/Either'
import { formatValidationErrors } from 'io-ts-reporters'
import { NonEmptyString } from 'io-ts-types/lib/NonEmptyString'

const envVars = t.type({
  AUTH0_DOMAIN: NonEmptyString,
  AUTH0_CLIENT_ID: NonEmptyString,
  AUTH0_CLIENT_SECRET: NonEmptyString,
})
export type Auth0EnvVars = t.TypeOf<typeof envVars>

const loadEnvironment = (): Auth0EnvVars =>
  pipe(
    envVars.decode(process.env),
    E.fold(
      (failure) => {
        console.error(formatValidationErrors(failure))
        process.exit(1)
      },
      (success) => ({
        AUTH0_DOMAIN: success.AUTH0_DOMAIN,
        AUTH0_CLIENT_ID: success.AUTH0_CLIENT_ID,
        AUTH0_CLIENT_SECRET: success.AUTH0_CLIENT_SECRET,
      })
    )
  )

const environment = loadEnvironment()
const auth0MgmtAPI = new ManagementClient({
  domain: environment.AUTH0_DOMAIN,
  clientId: environment.AUTH0_CLIENT_ID,
  clientSecret: environment.AUTH0_CLIENT_SECRET,
  scope: 'create:users',
})
const auth0AuthAPI = new AuthenticationClient({
  domain: environment.AUTH0_DOMAIN,
  clientId: environment.AUTH0_CLIENT_ID,
  clientSecret: environment.AUTH0_CLIENT_SECRET,
})

export type TasksEnv = Auth0EnvVars & {
  auth0MgmtAPI: typeof auth0MgmtAPI
  auth0AuthAPI: typeof auth0AuthAPI
}

const runningEnv: TasksEnv = {
  ...environment,
  auth0MgmtAPI,
  auth0AuthAPI,
}

export { runningEnv }
