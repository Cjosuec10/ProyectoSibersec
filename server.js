"use strict";

// Imports
import express from 'express';
import session from 'express-session';
import oktaPkg from '@okta/oidc-middleware';
const { ExpressOIDC } = oktaPkg;
import { validateMessage } from './unalib/index.js';

import { Issuer } from 'openid-client';
import openidConnectPkg from 'express-openid-connect';
const { auth, requiresAuth } = openidConnectPkg;

import cons from 'consolidate';
import path from 'path';
import https from 'https';
import fs from 'fs';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';

import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Globals
const OKTA_ISSUER_URI = "https://dev-wg3dffyd62bk6loh.us.auth0.com";
const OKTA_CLIENT_ID = "2qYAHuCSoo64h73nrOtzcx0nXCHQVMzC";
const OKTA_CLIENT_SECRET = "Do0G9vQjzVA0fgwnIhgywIc-aVYqrxAToqBStVKq8oHZ5b1H6baLD2JUaYQnhXFu";
const REDIRECT_URI = "http://localhost:3000/dashboard";
const PORT = process.env.PORT || "3000";
const SECRET = "hjsadfghjakshdfg87sd8f76s8d7f68s7f632342ug44gg423636346f";

// SSL Certificate Paths (Replace with your certificate file paths)
const sslOptions = {
  key: fs.readFileSync('certs/localhost/localhost.key'),  // Path to your SSL key
  cert: fs.readFileSync('certs/localhost/localhost.crt') // Path to your SSL certificate
};

// App configuration for Okta and OpenID
const config = {
  authRequired: false,
  auth0Logout: true,
  secret: SECRET,
  baseURL: 'https://localhost:3000',
  clientID: OKTA_CLIENT_ID,
  issuerBaseURL: OKTA_ISSUER_URI
};

let oidc = new ExpressOIDC({
  issuer: OKTA_ISSUER_URI,
  client_id: OKTA_CLIENT_ID,
  client_secret: OKTA_CLIENT_SECRET,
  redirect_uri: REDIRECT_URI,
  routes: { callback: { defaultRedirect: "https://localhost:3000/dashboard" } },
  scope: 'openid profile'
});

// Express app setup
let app = express();
let server = https.createServer(sslOptions, app);
let io = new SocketIOServer(server);

// MVC View Setup
app.engine('html', cons.swig);
app.set('views', path.join(__dirname, 'views'));
app.set('models', path.join(__dirname, 'models'));
app.set('view engine', 'html');

// App middleware
app.use("/static", express.static("static"));
app.use(session({
  cookie: { httpOnly: true },
  resave: false,  // No volver a guardar la sesión si no ha sido modificada
  saveUninitialized: false,  // No guardar sesiones no inicializadas
  secret: SECRET
}));

app.use(auth(config));

// App routes
app.get("/", (req, res) => {
  res.render("index");
});  


// Middleware (requiresAuth) for protected route
app.get("/dashboard", requiresAuth(), (req, res) => {  
  var payload = Buffer.from(req.appSession.id_token.split('.')[1], 'base64').toString('utf-8');
  const userInfo = JSON.parse(payload);
  res.render("dashboard", { user: userInfo });
});

// Ruta específica para servir index.html en la URL /UNAChat
app.get('/UNAChat', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

Issuer.defaultHttpOptions.timeout = 20000;

// Socket.IO setup
io.on('connection', function(socket) {
  console.log("User connected via Socket.IO");
  socket.on('Evento-Mensaje-Server', function(msg) {
    var validMsg = validateMessage(msg);
    io.emit('Evento-Mensaje-Server', validMsg);
  });
});

// Start the server with HTTPS
oidc.on("ready", () => {
  server.listen(PORT, () => {
    console.log("HTTPS Server running on port: " + PORT);
  });
});

oidc.on("error", err => {
  console.error(err);
});

// Export the app for use in tests
export default app;
