const app = require('./app');

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`CareCompanion API running on port ${PORT}`);
  console.log(`Version: ${process.env.APP_VERSION || '1.0.0'}`);
});
