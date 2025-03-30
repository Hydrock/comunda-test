# Урок: Простой проект на Node.js и Camunda 7

## Цель урока

Создать тестовый проект, где Node.js-сервер запускает процесс в Camunda 7 посредством REST API, и после этого процесс выполняет внешнюю задачу, обрабатываемую Node.js.

---

## Шаг 1. Установка Camunda 7 через Docker

`docker-compose.yml`:

```yaml
services:
  camunda:
    image: camunda/camunda-bpm-platform:run-latest
    ports:
      - "8080:8080"
```

```bash
docker compose up -d
```

Интерфейс будет доступен на: <http://localhost:8080>  
Пользователь: `demo` / Пароль: `demo`

---

## Шаг 2. Создание BPMN-диаграммы в Camunda Modeler

1. Скачай Camunda Modeler: <https://camunda.com/download/modeler/>
2. Создай новую BPMN-диаграмму
3. Общая схема:
   - Start Event
   - User Task (Проверить заявку)
   - Service Task (External Task: topic `process-in-node`)
   - End Event
4. Укажи `historyTimeToLive = 7` дней в настройках процесса
5. Сохрани как `process_application.bpmn`

---

## Шаг 3. Развернуть BPMN-файл через Camunda Modeler

1. Нажми **Deploy current diagram** (иконка облака со стрелкой вверх)
2. Endpoint: `http://localhost:8080/engine-rest`
3. Логин: `demo` / Пароль: `demo`
4. Нажми **Deploy**

---

## Шаг 4. Создание Node.js сервера

```bash
mkdir camunda-node-test && cd camunda-node-test
npm init -y
npm install express axios body-parser
```

### `index.js`

```js
const express = require('express');
const axios = require('axios');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const CAMUNDA_URL = 'http://localhost:8080/engine-rest';

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/start-process', async (req, res) => {
  try {
    const result = await axios.post(`${CAMUNDA_URL}/process-definition/key/process_application/start`, {
      variables: {
        applicantName: { value: req.body.name, type: "String" }
      }
    });
    res.json(result.data);
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).send("Ошибка запуска процесса");
  }
});

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
```

---

## Шаг 5. HTML-форма для запуска процесса

### `public/index.html`

```html
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <title>Заявка</title>
</head>
<body>
  <h1>Подать заявку</h1>
  <form id="application-form">
    <label for="name">Имя заявителя:</label>
    <input type="text" id="name" name="name" required>
    <button type="submit">Отправить</button>
  </form>

  <div id="result" style="margin-top: 20px;"></div>

  <script>
    document.getElementById('application-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('name').value;
      const resBlock = document.getElementById('result');
      resBlock.innerHTML = "Отправка...";
      try {
        const response = await fetch('/start-process', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name })
        });
        if (response.ok) {
          const data = await response.json();
          resBlock.innerHTML = `Процесс запущен! ID: ${data.id}`;
        } else {
          resBlock.innerHTML = "Ошибка запуска процесса";
        }
      } catch (err) {
        resBlock.innerHTML = "Ошибка соединения";
      }
    });
  </script>
</body>
</html>
```

---

## Шаг 6. Запуск и тест

1. Запусти Node.js:

```bash
node index.js
```

2. Открой браузер:
👉 <http://localhost:3000>

3. Заполни форму и нажми **Отправить**

4. Процесс запустится в Camunda и выполнит External Task

---

## Готово! 🎉

Теперь у тебя есть полноценный мини-проект Node.js + Camunda с BPMN-процессом, формой и External Task. Можно добавить базу данных, UI со статусами, или расширить процесс для реальных заявок.
