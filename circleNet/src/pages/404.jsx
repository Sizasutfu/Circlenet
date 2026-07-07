export default function Custom404() {
  return (
    <div style={{minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column'}}>
      <h1 style={{fontSize: 72, margin: 0}}>404</h1>
      <p style={{marginTop: 12}}>Page not found.</p>
      <a href="/" style={{marginTop: 18, padding: '10px 16px', background: '#0ea5a3', color: '#fff', borderRadius: 8, textDecoration: 'none'}}>Feed</a>
    </div>
  );
}
