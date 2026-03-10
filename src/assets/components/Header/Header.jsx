import React from "react"
import './Header.css'
import { Link } from "react-router-dom"


const Header = ()=> {
    
    return(
        <>
            <p></p>
            <div className="header">
                <Link to="/">Dashboard</Link>
                <Link to="/search">Поиск</Link>
                <Link to="/setting">Настройки</Link>
            </div>
        </>
    )
}

export default Header