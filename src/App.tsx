import { useState } from 'react'
import Game from './pages/Game'

function App() {
  return (
    <div style={{ padding: "1rem" }}>
      <h1 className='text-4xl'>minesweeper.io</h1>
      <Game />
    </div>
  )
}

export default App
