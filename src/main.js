import './styles.css';
import './accessible.css';
const admin=location.pathname.startsWith('/admin');
document.querySelector('link[rel="manifest"]').href=admin?'/admin.webmanifest':'/wychowawca.webmanifest';
document.title=admin?'MOW Fanpage – Admin':'MOW Fanpage – Wychowawca';
if (import.meta.env.PROD && 'serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(console.warn);
import('./app.js').then(({startApp})=>startApp()).catch(error=>{
  document.querySelector('#app').textContent='Nie udało się uruchomić aplikacji. Odśwież stronę lub przekaż administratorowi komunikat: '+error.message;
});
