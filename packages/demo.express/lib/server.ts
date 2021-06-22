import express from 'express';
import { apiRouter } from './api/router';

const app = express();

// @fixme

app.use('/api/v1/auth', apiRouter);
