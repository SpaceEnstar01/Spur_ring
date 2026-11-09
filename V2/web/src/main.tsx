import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";

import {configureBackend} from './taskApi';
async function boot(){
 try {const r=await fetch('/api/web-backend',{signal:AbortSignal.timeout(5000),cache:'no-store'});if(r.ok)configureBackend(await r.json())}catch{}
 ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
}
void boot();

import "./v5.css";
