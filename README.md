# Notification Service

A Node.js-based notification service that supports multiple notification channels (Email, SMS, and in-app notifications) with message queuing and retry mechanism.

## Features

- Multiple notification channels (Email, SMS, in-app)
- Message queuing using RabbitMQ
- Retry mechanism for failed notifications
- RESTful API endpoints

## Prerequisites

- Node.js (v14 or higher)
- RabbitMQ Server
- npm or yarn

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables:
- Copy `.env.example` to `.env`
- Update the variables with your credentials

3. Start RabbitMQ server (if not running)

4. Start the application:
```bash
npm start
```

## API Endpoints

1. Send Notification
```
POST /notifications
Body: {
    "userId": "123",
    "type": "email|sms|in-app",
    "content": "Your notification message"
}
```

2. Get User Notifications
```
GET /users/{userId}/notifications
```

## Error Handling

- The service implements a retry mechanism for failed notifications
- Maximum 3 retries with exponential backoff
- Failed status after max retries reached
