const express = require('express');
const cors = require('cors');
const amqp = require('amqplib');
const bodyParser = require('body-parser');
const net = require('net');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// RabbitMQ connection
let channel, connection;

async function connectQueue(retryCount = 0) {
    try {
        console.log('Attempting to connect to RabbitMQ...');
        connection = await amqp.connect('amqp://guest:guest@localhost:5672');
        channel = await connection.createChannel();
        await channel.assertQueue('notification_queue');
        console.log('Successfully connected to RabbitMQ');
        return true;
    } catch (error) {
        console.error(`Error connecting to RabbitMQ (attempt ${retryCount + 1}):`, error.message);
        if (retryCount < 5) {
            console.log(`Retrying in ${(retryCount + 1) * 2} seconds...`);
            await new Promise(resolve => setTimeout(resolve, (retryCount + 1) * 2000));
            return connectQueue(retryCount + 1);
        }
        return false;
    }
}


connectQueue().then(success => {
    if (!success) {
        console.log('Failed to connect to RabbitMQ after multiple attempts');
    }
});

// In-memory storage for notifications (replace with database in production)
const notifications = {};

// Routes
app.post('/notifications', async (req, res) => {
    try {
        const { userId, type, content } = req.body;
        
        if (!userId || !type || !content) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const notification = {
            id: Date.now().toString(),
            userId,
            type,
            content,
            status: 'pending',
            createdAt: new Date(),
            retries: 0
        };

        // Store notification
        if (!notifications[userId]) {
            notifications[userId] = [];
        }
        notifications[userId].push(notification);

        // Send to queue for processing
        await channel.sendToQueue(
            'notification_queue',
            Buffer.from(JSON.stringify(notification))
        );

        res.status(201).json(notification);
    } catch (error) {
        console.error('Error sending notification:', error);
        res.status(500).json({ error: 'Failed to send notification' });
    }
});

app.get('/users/:userId/notifications', (req, res) => {
    const { userId } = req.params;
    const userNotifications = notifications[userId] || [];
    res.json(userNotifications);
});

// Start consumer
async function processNotification(notification) {
    const { type, content, userId } = notification;
    
    try {
        switch (type) {
            case 'email':
                // Implement email sending logic
                console.log(`Sending email to user ${userId}: ${content}`);
                break;
            case 'sms':
                // Implement SMS sending logic
                console.log(`Sending SMS to user ${userId}: ${content}`);
                break;
            case 'in-app':
                console.log(`Sending in-app notification to user ${userId}: ${content}`);
                break;
            default:
                throw new Error('Invalid notification type');
        }
        
        const userNotifications = notifications[userId];
        const notificationIndex = userNotifications.findIndex(n => n.id === notification.id);
        if (notificationIndex !== -1) {
            userNotifications[notificationIndex].status = 'delivered';
        }
    } catch (error) {
        console.error('Error processing notification:', error);
        
        if (notification.retries < 3) {
            notification.retries++;
            setTimeout(() => {
                channel.sendToQueue('notification_queue', Buffer.from(JSON.stringify(notification)));
            }, 5000 * notification.retries); 
        } else {
            const userNotifications = notifications[userId];
            const notificationIndex = userNotifications.findIndex(n => n.id === notification.id);
            if (notificationIndex !== -1) {
                userNotifications[notificationIndex].status = 'failed';
            }
        }
    }
}
async function startConsumer() {
    if (!channel) {
        console.log('Waiting for RabbitMQ connection...');
        return;
    }
    try {
        console.log('Starting message consumer...');
        channel.consume('notification_queue', data => {
            const notification = JSON.parse(data.content);
            processNotification(notification);
            channel.ack(data);
        });
        console.log('Message consumer started successfully');
    } catch (error) {
        console.error('Error in consumer:', error);
    }
}

const isPortAvailable = (port) => {
    return new Promise((resolve) => {
        const server = net.createServer()
            .once('error', () => resolve(false))
            .once('listening', () => {
                server.close();
                resolve(true);
            })
            .listen(port);
    });
};

const findAvailablePort = async (startPort) => {
    let currentPort = startPort;
    while (!(await isPortAvailable(currentPort))) {
        currentPort++;
    }
    return currentPort;
};

findAvailablePort(port).then(availablePort => {
    app.listen(availablePort, () => {
        console.log(`Notification service running on port ${availablePort}`);
        startConsumer();
    });
}).catch(err => {
    console.error('Error starting server:', err);
    process.exit(1);
});
