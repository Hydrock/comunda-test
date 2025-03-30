const express = require('express');
const axios = require('axios');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const CAMUNDA_URL = 'http://localhost:8080/engine-rest';

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public'))); // Раздача index.html

// Путь на главную страницу
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Запуск процесса
app.post('/start-process', async (req, res) => {
    try {
        const result = await axios.post(`${CAMUNDA_URL}/process-definition/key/process_application/start`, {
            variables: {
                applicantName: { value: req.body.name, type: "String" }
            }
        });

        console.log(`Процесс запущен! ID: ${result.data.id}`);
        res.json(result.data);
    } catch (err) {
        console.error(err.response?.data || err.message);
        res.status(500).send("Ошибка запуска процесса");
    }
});

// External Task обработка (осталось без изменений)
const pollTasks = async () => {
    try {
        const res = await axios.post(`${CAMUNDA_URL}/external-task/fetchAndLock`, {
            workerId: "node-worker-1",
            maxTasks: 1,
            topics: [
                {
                    topicName: "process-in-node",
                    lockDuration: 10000
                }
            ]
        });

        for (const task of res.data) {
            console.log("Получена задача:", task.id);

            await axios.post(`${CAMUNDA_URL}/external-task/${task.id}/complete`, {
                workerId: "node-worker-1",
                variables: {
                    processedBy: { value: "Node.js Worker", type: "String" }
                }
            });

            console.log("Задача завершена:", task.id);
        }
    } catch (err) {
        console.error("Ошибка при обработке задачи:", err.message);
    }
};

setInterval(pollTasks, 5000);

app.listen(3000, () => {
    console.log("Node.js сервер запущен на http://localhost:3000");
});
