import axios from 'axios'

// All requests go through Vite's proxy → Flask on :5000
const BASE = '/api'

export async function fetchDefaultData() {
  const { data } = await axios.get(`${BASE}/default-data`)
  return data
}

export async function solveSchedule(payload) {
  const { data } = await axios.post(`${BASE}/solve`, payload)
  return data  // { solution, steps, stats }
}
