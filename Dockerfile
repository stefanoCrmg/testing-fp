FROM node:16-alpine3.11 AS base
WORKDIR /app
ARG JFROG_NPM_PASSWORD
ARG JFROG_USERNAME
ARG JFROG_EMAIL
COPY package.json yarn.lock ./
RUN echo "@credimi:registry=https://instapartners.jfrog.io/artifactory/api/npm/credimi-npm/" >> ~/.npmrc && \
  echo "//instapartners.jfrog.io/artifactory/api/npm/credimi-npm/:_password=$JFROG_NPM_PASSWORD" >> ~/.npmrc && \
  echo "//instapartners.jfrog.io/artifactory/api/npm/credimi-npm/:username=$JFROG_USERNAME" >> ~/.npmrc && \
  echo "//instapartners.jfrog.io/artifactory/api/npm/credimi-npm/:email=$JFROG_EMAIL" >> ~/.npmrc && \
  echo "//instapartners.jfrog.io/artifactory/api/npm/credimi-npm/:always-auth=true" >> ~/.npmrc && \
  yarn && \
  rm -f .npmrc
# RUN echo "@credimi:registry=https://instapartners.jfrog.io/instapartners/api/npm/credimi-npm/" >> .npmrc && \
#   echo "//instapartners.jfrog.io/instapartners/api/npm/credimi-npm/:_authToken=$NPM_CREDIMI_TOKEN" >> .npmrc && \

COPY . /app

FROM base AS builder
RUN yarn build
COPY --from=base app .

FROM builder AS production
COPY --from=builder /app/build .

EXPOSE 4000
CMD ["yarn", "run", "start"]
