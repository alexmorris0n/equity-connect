<template>
  <div class="not-found">
    <h1>404</h1>
    <p>Page not found</p>
    <router-link to="/" class="btn btn-primary">Go Home</router-link>
  </div>
</template>

<style scoped>
.not-found {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 2rem;
}

h1 {
  font-size: 4rem;
  color: var(--text-primary);
  margin-bottom: 1rem;
}

p {
  color: var(--text-secondary);
  margin-bottom: 2rem;
}
</style>

