import './assets/css/5b1034541a380162.css'
import './assets/css/80e3069995354a8f.css'
import './assets/css/aa15fe3776697b1b.css'
import 'intl-tel-input/build/css/intlTelInput.css'
import setupDisableDevtools from './utils/disable-devtools'
import { i18n } from "./i18n";
import { createApp } from 'vue'
import App from './App.vue'
import router from './router'

const app = createApp(App);
app.use(i18n);
app.use(router)
app.mount('#app')
setupDisableDevtools({
    enableDetector: true,
})
