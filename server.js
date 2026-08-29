const express = require('express');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

const app = express();
app.use(express.json());

// Serve all static files from the 'public' folder
app.use(express.static('public'));

const SUBSCRIPTION_KEY = process.env.SUBSCRIPTION_KEY;
const MOMO_BASE_URL = process.env.MOMO_BASE_URL || 'https://sandbox.momodeveloper.mtn.com';

let API_USER = process.env.MOMO_API_USER;
let API_KEY = process.env.MOMO_API_KEY;

// Auto-provision Sandbox API User & Key if not set
async function initializeMoMoSandbox() {
    if (API_USER && API_KEY) return;
    try {
        const userUuid = uuidv4();
        await axios.post(
            `${MOMO_BASE_URL}/v1_0/apiuser`,
            { providerCallbackHost: "webhook.site" },
            {
                headers: {
                    'X-Reference-Id': userUuid,
                    'Ocp-Apim-Subscription-Key': SUBSCRIPTION_KEY,
                    'Content-Type': 'application/json'
                }
            }
        );

        const keyRes = await axios.post(
            `${MOMO_BASE_URL}/v1_0/apiuser/${userUuid}/apikey`,
            {},
            {
                headers: {
                    'Ocp-Apim-Subscription-Key': SUBSCRIPTION_KEY
                }
            }
        );

        API_USER = userUuid;
        API_KEY = keyRes.data.apiKey;
        console.log("MoMo Sandbox initialized successfully.");
    } catch (error) {
        console.error("Sandbox Initialization Failed:", error.response ? error.response.data : error.message);
    }
}

// Function to generate Bearer Access Token
async function getAccessToken() {
    const authBuffer = Buffer.from(`${API_USER}:${API_KEY}`).toString('base64');
    const response = await axios.post(
        `${MOMO_BASE_URL}/collection/token/`,
        {},
        {
            headers: {
                'Authorization': `Basic ${authBuffer}`,
                'Ocp-Apim-Subscription-Key': SUBSCRIPTION_KEY
            }
        }
    );
    return response.data.access_token;
}

// Deposit Endpoint called by deposit.html
app.post('/api/deposit', async (req, res) => {
    const { phone, amount } = req.body;
    if (!phone || !amount) {
        return res.status(400).json({ error: 'Phone number and amount are required.' });
    }

    try {
        const token = await getAccessToken();
        const transactionId = uuidv4();

        // Trigger requesttopay PIN prompt on user's phone
        await axios.post(
            `${MOMO_BASE_URL}/collection/v1_0/requesttopay`,
            {
                amount: amount.toString(),
                currency: "EUR", // MoMo Sandbox defaults to EUR
                externalId: transactionId,
                payer: {
                    partyIdType: "MSISDN",
                    partyId: phone
                },
                payerMessage: "Payment for order",
                payeeNote: "Deposit"
            },
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'X-Reference-Id': transactionId,
                    'X-Target-Environment': 'sandbox',
                    'Ocp-Apim-Subscription-Key': SUBSCRIPTION_KEY,
                    'Content-Type': 'application/json'
                }
            }
        );

        res.json({ success: true, transactionId, message: 'Payment prompt sent to phone.' });
    } catch (error) {
        console.error("Payment Error:", error.response ? error.response.data : error.message);
        res.status(500).json({ error: 'Payment request failed.' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
    await initializeMoMoSandbox();
    console.log(`Server running on port ${PORT}`);
});
