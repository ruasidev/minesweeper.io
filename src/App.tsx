import { useState } from 'react'
import Board from "./components/Board"
import { NumberInput } from './components/NumberInput'

function App() {
  return (
    <div style={{ padding: "1rem" }}>
      <h1>minesweeper.io</h1>
      <Board />
    </div>
  )
}

export default App
