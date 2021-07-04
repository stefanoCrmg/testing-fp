import pino from 'express-pino-logger'
const PinoLogger = pino({
  prettyPrint: process.env.NODE_ENV === 'development',
  autoLogging: false,
  serializers: {
    req: (req) => ({
      method: req.method,
      url: req.url,
    }),
  },
})

export { PinoLogger }
