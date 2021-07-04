import express from 'express'
import { cors, parseJsonMiddleware } from './middlewares/middlewares'
import { PinoLogger } from './logger-config'
import { createSignupAgencyRoute } from './routers/signup-agency.router'

const main = () => {
  const expressServer = express()
  expressServer.use(PinoLogger)
  expressServer.use(cors)
  expressServer.use(parseJsonMiddleware)
  expressServer.use('/agencies', createSignupAgencyRoute())
  expressServer.listen({ port: 4000 })
  PinoLogger.logger.info(`🚀 Express Server ready at http://localhost:4000`)
}

main()
