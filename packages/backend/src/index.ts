import express from 'express'
import cors from 'cors'
import { migrate } from './db/migrate'
import { errorHandler } from './middleware/errorHandler'
import authRouter from './routes/auth.routes'
import movementRouter from './routes/movement.routes'
import alertRouter from './routes/alert.routes'
import productRouter from './routes/product.routes'
import userRouter from './routes/user.routes'
import notificationRouter from './routes/notification.routes'
import dashboardRouter from './routes/dashboard.routes'

const app = express()

app.use(express.json())

// Requirements 11.5, 11.6: restrict CORS to configured origin in production,
// allow localhost:5173 in development
const corsOrigin =
  process.env.NODE_ENV === 'production'
    ? process.env.CORS_ORIGIN
    : ['http://localhost:5173', 'http://localhost:5174']

app.use(cors({ origin: corsOrigin, credentials: true }))

app.get('/health', (_req, res) => {
  res.json({ ok: true, env: process.env.NODE_ENV })
})

// Auth routes — mounted at /api/auth
app.use('/api/auth', authRouter)

// Product routes — mounted at /api/products
app.use('/api/products', productRouter)

// Movement routes — mounted at /api/movements
app.use('/api/movements', movementRouter)

// Alert routes — mounted at /api/alerts
app.use('/api/alerts', alertRouter)

// Notification routes — mounted at /api/notifications
app.use('/api/notifications', notificationRouter)

// User management routes — mounted at /api/users
app.use('/api/users', userRouter)

// Dashboard routes — mounted at /api/dashboard
app.use('/api/dashboard', dashboardRouter)

// Global error handler — must be registered AFTER all routes
app.use(errorHandler)

const PORT = process.env.PORT || 3001

// Run schema migrations before accepting any connections
migrate()

app.listen(PORT, () => {
  console.log(`INVENTRACK API listening on port ${PORT}`)
})

export default app
