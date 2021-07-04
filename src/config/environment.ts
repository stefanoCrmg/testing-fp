import { pipe } from 'fp-ts/lib/function'
import * as t from 'io-ts'
import * as E from 'fp-ts/Either'
import { formatValidationErrors } from 'io-ts-reporters'
import { NonEmptyString } from 'io-ts-types/lib/NonEmptyString'
import { PinoLogger } from '../logger-config'

const envVars = t.type({
  AUTH0_DOMAIN: NonEmptyString,
  AUTH0_CLIENT_ID: NonEmptyString,
  AUTH0_CLIENT_SECRET: NonEmptyString,
})

const loadEnvironment = () =>
  pipe(
    envVars.decode(process.env),
    E.fold(
      (failure) => {
        PinoLogger.logger.error(formatValidationErrors(failure))
        process.exit(1)
      },
      (success) => {
        return {
          auth0: {
            domain: success.AUTH0_DOMAIN,
            clientId: success.AUTH0_CLIENT_ID,
            clientSecret: success.AUTH0_CLIENT_SECRET,
          },
        }
      }
    )
  )

export { loadEnvironment }
