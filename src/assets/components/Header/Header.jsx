import React from "react"
import './Header.css'
import { Link } from "react-router-dom"


const Header = ()=> {
    return(
        <>
            <p></p>
            <div className="header">
                <div className="logo__box">Поиск на HH</div>
                <div className="nav__box">
                    <ul className="nav__list">
                        <li className="nav__item"><Link to="/">Dashboard</Link></li>
                        <li className="nav__item"><Link to="/search">Поиск</Link></li>
                        <li className="nav__item"><Link to="/setting">Настройки</Link></li>
                        <li className="nav__item"><Link to="/history">История</Link></li>
                    </ul>
                </div>
                <div className="user__box">
                    <div className="user__item">
                        <img src="" alt="" />
                    </div>
                    <div className="user__item">
                        Тестовый текст
                    </div>
                </div>
            </div>
        </>
    )
}

export default Header