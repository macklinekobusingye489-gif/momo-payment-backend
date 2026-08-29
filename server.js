const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

const SUBSCRIPTION_KEY = process.env.SUBSCRIPTION_KEY;
const MOMO_BASE_URL = process.env.MOMO_BASE_URL || 'https://sandbox.momodeveloper.mtn.com';

let API_USER = process.env.MOMO_API_USER;
let API_KEY = process.env.MOMO_API_KEY;

// Auto-creates Sandbox User and Key if not present
async function initializeMoMoSandbox() {
    if (API_USER && API_KEY) return;

    try {
        const userUuid = uuidv4();
        
        // Step A: Create API User
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

        // Step B: Create API Key
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

        console.log("MoMo Sandbox Initialized Successfully:");
        console.log("API_USER:", API_USER);
        console.log("API_KEY:", API_KEY);
    } catch (error) {
        console.error("Initialization Failed:", error.response ? error.response.data : error.message);
    }
}

// Call during server start
initializeMoMoSandbox();
