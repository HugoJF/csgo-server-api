# NodeJS CS:GO Server API

Very simple HTTP API for CS:GO servers with token authentication to avoid distributing RCON passwords between applications and having to update server lists.

## Requirements
  - Node 10+ or Docker
  
## Installation via Node
###### Please do not open issues if you have problems when installing directly with Node.

Install dependencies by running:
```bash
npm install
```

Transpile the source code with Babel:
```bash
npm run babel
```

Create `servers.json` file:
```bash
cp config/servers.json.example config/servers.json
```

Update `servers.json` with your information


Run (**make sure you have Node version 10+**)
```bash
npm run start
```

## Installation via Docker

Build Docker image
```bash
npm run build
```

Create `servers.json` file:
```bash
cp config/servers.json.example config/servers.json
```

Update `servers.json` with your information


Run 
```bash
npm run docker
```

## Usage

API specification is provided as an OpenAPI spec on `oas.yaml`
