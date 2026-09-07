import './styles.css';
import { startApp } from './app.js';
if ('serviceWorker' in navigator) window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js').catch(console.warn));
startApp(document.querySelector('#app'));
