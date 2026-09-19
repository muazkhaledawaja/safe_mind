const env = require('./config/env');
const app = require('./app');

app.listen(env.PORT, () => {
  console.log(`Safe Mind API listening on port ${env.PORT}`);
  console.log(`API docs:            http://localhost:${env.PORT}/api/docs`);
});
