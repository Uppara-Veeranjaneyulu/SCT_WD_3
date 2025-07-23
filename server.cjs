const express = require('express');
const cors = require('cors');
const { MongoClient } = require('mongodb');

const app = express();
app.use(cors());
app.use(express.json());

const uri = 'mongodb+srv://uupparaveeranji:yqVJoc6ZBEKVkhFr@cluster0.sfgd0fc.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';
const client = new MongoClient(uri);

const dbName = 'tic_tac_toe';
const collectionName = 'game_history';

// Connect and store game
app.post('/api/save-game', async (req, res) => {
  try {
    await client.connect();
    const db = client.db(dbName);
    const result = await db.collection(collectionName).insertOne(req.body);
    res.status(200).json({ success: true, insertedId: result.insertedId });
  } catch (error) {
    console.error('Save Error:', error);
    res.status(500).json({ success: false });
  }
});

// Fetch game history
app.get('/api/game-history', async (req, res) => {
  try {
    await client.connect();
    const db = client.db(dbName);
    const data = await db.collection(collectionName).find().toArray();
    res.status(200).json(data);
  } catch (error) {
    console.error('Fetch Error:', error);
    res.status(500).json({ success: false });
  }
});

app.listen(5000, () => {
  console.log('✅ Server running on http://localhost:5000');
});
