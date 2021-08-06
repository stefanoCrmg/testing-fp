# testing-fp

A small playground I'm using to try and learn fp-ts and io-ts.

Right now it's just a small server to be used to signup users to auth0, reset their password while saving some of the information on a prisma-backed postgres DB.

fp-ts is used to wrap the fetch calls in TaskEithers and setup some sort of railway programming. 
io-ts to validate at run time the data received from auth0 as well as the data coming in from the requests to the server itself.
