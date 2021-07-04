import express, { ErrorRequestHandler, RequestHandler } from 'express'
import jwt from 'express-jwt'
import jwksRsa from 'jwks-rsa'

export const cors: RequestHandler = (_req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE')
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.header('Access-Control-Allow-Credentials', 'true')

  return next()
}

const catchJwtErrorHandler: ErrorRequestHandler = (err, req, res, next) => {
  if (err.name === 'UnauthorizedError') {
    req.log.error('Missing/expired/invalid token request.')
    res.status(401).send({ errorMessage: 'Missing, expired or invalid token.' })
  } else {
    next()
  }
}

const runJwtCheck: RequestHandler = jwt({
  secret: jwksRsa.expressJwtSecret({
    cache: true,
    rateLimit: true,
    jwksRequestsPerMinute: 5,
    jwksUri: `https://${process.env.AUTH0_DOMAIN}/.well-known/jwks.json`,
  }),
  audience: process.env.AUTH0_AUDIENCE,
  issuer: `https://${process.env.AUTH0_DOMAIN}/`,
  algorithms: ['RS256'],
})

const expressJsonParserErrorHandler: ErrorRequestHandler = (err, req, res, next) => {
  if (err instanceof SyntaxError) {
    req.log.error(err.message)
    res.status(400).send({ errorMessage: err.message })
  } else {
    next()
  }
}

const checkJwt = [runJwtCheck, catchJwtErrorHandler]
const parseJsonMiddleware = [express.json(), expressJsonParserErrorHandler]
export { checkJwt, parseJsonMiddleware }
