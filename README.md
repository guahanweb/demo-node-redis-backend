# DEMO: Node.js + Redis (backend)

Service and API layer for a full stack demo app. This repo specifically
implements a Node.js service layer exposing Express routes to handle
client integration as well as connections to a redis layer.

## Getting up and running

If you wish to run this layer independently from the full stack, it is
assumed you already have a Redis image running locally on port 6379.

```sh
# clone the repo
git clone git@github.com:guahanweb/demo-node-redis-backend.git backend
cd backend

# install dependencies and run
npm install
npm run start:dev
```
