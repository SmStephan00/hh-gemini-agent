


import { BrowserRouter, Route, Routes } from 'react-router-dom'
import './App.css'
import Header from './assets/components/Header/Header'
import DashBoard from './assets/pages/Dashboard/DashBoard'
import Setting from './assets/pages/Setting/Setting'
import Search from './assets/pages/Search/Logs'
import History from './assets/pages/History/History'
import Logs from './assets/pages/Search/Logs'



function App() {
  

  return (
    <BrowserRouter>
    <div className='container'>
      <Header></Header>
       <div className='box__contant'>
          <Routes>
            <Route path='/' element={<DashBoard/>} />
            <Route path="/logs" element={<Logs/>} />
            <Route path="/setting" element={<Setting/>} />
            <Route path="/history" element={<History/>} />
          </Routes>
        </div>
      </div>
    </BrowserRouter>
  )
}

export default App
