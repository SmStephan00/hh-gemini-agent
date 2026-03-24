const FormBox = ({title, children}) => {
    return ( 
        <div className="form__box">
            <div className="box__show">
                <button className="button__fonctional">Скрыть</button>
            </div>
            <div className="title">
                 <h2>{title}</h2>
            </div>
            {children}
        </div>
     );
}
 
export default FormBox;