import axios from 'axios';

const GUPSHUP_API_URL = 'https://api.gupshup.io/wa/api/v1/template/msg';
const GUPSHUP_API_KEY = process.env.GUPSHUP_API_KEY;
const GUPSHUP_SOURCE = process.env.GUPSHUP_SOURCE || '918484958580';
const GUPSHUP_APP_NAME = process.env.GUPSHUP_APP_NAME || 'selfcruzlogin';
const GUPSHUP_TEMPLATE_ID = process.env.GUPSHUP_TEMPLATE_ID || '1735f0b5-500d-43e5-9049-bfe635b7fd4d';

// In-memory OTP store (use Redis in production for better scalability)
const otpStore = new Map();

// Generate 6-digit OTP
const generateOTP = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

// Send OTP via WhatsApp using Gupshup
export const sendOTP = async (phoneNumber) => {
    try {
        // Format phone number (ensure it has country code without +)
        let formattedPhone = phoneNumber.replace(/\D/g, '');
        if (formattedPhone.length === 10) {
            formattedPhone = `91${formattedPhone}`;
        }
        if (formattedPhone.startsWith('+')) {
            formattedPhone = formattedPhone.substring(1);
        }

        // Generate OTP
        const otp = generateOTP();
        
        // Store OTP with expiry (5 minutes)
        otpStore.set(formattedPhone, {
            otp,
            expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes
            attempts: 0
        });

        // Prepare request data
        const params = new URLSearchParams();
        params.append('channel', 'whatsapp');
        params.append('source', GUPSHUP_SOURCE);
        params.append('destination', formattedPhone);
        params.append('src.name', GUPSHUP_APP_NAME);
        params.append('template', JSON.stringify({
            id: GUPSHUP_TEMPLATE_ID,
            params: [otp]
        }));

        // Send WhatsApp message via Gupshup
        const response = await axios.post(GUPSHUP_API_URL, params, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'apikey': GUPSHUP_API_KEY,
                'Cache-Control': 'no-cache'
            }
        });

        console.log('Gupshup response:', response.data);

        if (response.data.status === 'submitted' || response.status === 200) {
            return { success: true, status: 'pending', message: 'OTP sent successfully via WhatsApp' };
        } else {
            console.error('Gupshup error:', response.data);
            return { success: false, message: response.data.message || 'Failed to send OTP' };
        }
    } catch (error) {
        console.error('Gupshup sendOTP error:', error.response?.data || error.message);
        return { success: false, message: error.response?.data?.message || error.message };
    }
};

// Verify OTP
export const verifyOTP = async (phoneNumber, code) => {
    try {
        // Format phone number
        let formattedPhone = phoneNumber.replace(/\D/g, '');
        if (formattedPhone.length === 10) {
            formattedPhone = `91${formattedPhone}`;
        }
        if (formattedPhone.startsWith('+')) {
            formattedPhone = formattedPhone.substring(1);
        }

        // Get stored OTP
        const storedData = otpStore.get(formattedPhone);

        if (!storedData) {
            return { success: false, message: 'OTP not found. Please request a new OTP.' };
        }

        // Check if OTP is expired
        if (Date.now() > storedData.expiresAt) {
            otpStore.delete(formattedPhone);
            return { success: false, message: 'OTP has expired. Please request a new OTP.' };
        }

        // Check attempts (max 3)
        if (storedData.attempts >= 3) {
            otpStore.delete(formattedPhone);
            return { success: false, message: 'Too many failed attempts. Please request a new OTP.' };
        }

        // Verify OTP
        if (storedData.otp === code) {
            otpStore.delete(formattedPhone); // Remove after successful verification
            return { success: true, status: 'approved' };
        } else {
            // Increment attempts
            storedData.attempts += 1;
            otpStore.set(formattedPhone, storedData);
            return { success: false, message: 'Invalid OTP. Please try again.' };
        }
    } catch (error) {
        console.error('verifyOTP error:', error.message);
        return { success: false, message: error.message };
    }
};

// Clean up expired OTPs periodically
setInterval(() => {
    const now = Date.now();
    for (const [phone, data] of otpStore.entries()) {
        if (now > data.expiresAt) {
            otpStore.delete(phone);
        }
    }
}, 60000); // Clean every minute
