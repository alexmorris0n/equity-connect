import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import 'vfonts/Lato.css'
import 'vfonts/FiraCode.css'
import './assets/theme.css'
import './assets/main.css'

const app = createApp(App)

app.use(router)
app.mount('#app')

