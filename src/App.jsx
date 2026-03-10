


import { BrowserRouter, Route, Routes } from 'react-router-dom'
import './App.css'
import Header from './assets/components/Header/Header'
import DashBoard from './assets/pages/Dashboard/DashBoard'
import Setting from './assets/pages/Setting/Setting'
import Search from './assets/pages/Search/Serch'


function App() {
  

  return (
    <BrowserRouter>
      <Header></Header>
       <div className='container__contant'>
          <Routes>
            <Route path='/' element={<DashBoard />} />
            <Route path="/search" element={<Search />} />
            <Route path="/setting" element={<Setting />} />
          </Routes>
        </div>
    </BrowserRouter>
  )
}

export default App
