import * as crypto from 'crypto'
import { pipe } from 'fp-ts/lib/function'
import * as RTE from 'fp-ts/ReaderTaskEither'
import * as TE from 'fp-ts/TaskEither'
import * as C from 'fp-ts/Console'
import { parse } from 'csv-parse'
import fs from 'fs'
import { exit } from 'process'
import { runningEnv, TasksEnv } from './config/environment'

type UserFromCSV = {
  Cognome: string
  Nome: string
  'P.IVA': string
  'Tipo di società': string
  Regione: string
  Città: string
  Indirizzo: string
  CAP: string
  Email: string
}

const taskMgmt = (user: UserFromCSV): RTE.ReaderTaskEither<TasksEnv, string, unknown> =>
  pipe(
    C.info(`${user.Email}: Creating account for ${user.Email}`),
    RTE.rightIO,
    RTE.chain(() => RTE.ask<TasksEnv>()),
    RTE.chainTaskEitherK(({ auth0MgmtAPI }) =>
      TE.tryCatch(
        () =>
          auth0MgmtAPI.createUser({
            connection: 'Username-Password-Authentication',
            email_verified: false,
            password: crypto.randomBytes(32).toString('base64'),
            verify_email: true,
            name: user.Nome,
            email: user.Email,
          }),
        (reason) => `Couldn't signup user: ${user.Email} - ${reason}`
      )
    )
  )

const taskAuth = (user: UserFromCSV): RTE.ReaderTaskEither<TasksEnv, string, void> =>
  pipe(
    C.info(`${user.Email}: Sending email reset password to ${user.Email}`),
    RTE.rightIO,
    RTE.chain(() => RTE.ask<TasksEnv>()),
    RTE.chainTaskEitherK(({ auth0AuthAPI }) =>
      TE.tryCatch(
        () =>
          auth0AuthAPI.requestChangePasswordEmail({
            email: user.Email,
            connection: 'Username-Password-Authentication',
          }),
        (reason) => `Couldn't send email reset: ${user.Email} - ${reason}`
      )
    )
  )

const taskCompleteSignup = (user: UserFromCSV) =>
  pipe(
    taskMgmt(user),
    RTE.chain(() => taskAuth(user)),
    RTE.bimap(
      (error) => console.error(error),
      () => console.log(`${user.Email} signed up`)
    )
  )

const parser = parse({ columns: true, delimiter: ';' }, (error, records: UserFromCSV[]) => {
  if (error) {
    console.error('Parsing error: ', error)
    exit(-1)
  }
  records.map((user) => taskCompleteSignup(user)(runningEnv)())
})

fs.createReadStream('TypeForm_Responses_stefano.csv').pipe(parser)
