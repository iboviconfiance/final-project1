try {
  const d = new Date().toLocaleString('fr-FR', { timeZone: 'Africa/Brazzaville' });
  console.log('Success:', d);
} catch(e) {
  console.log('Error:', e.message);
}
