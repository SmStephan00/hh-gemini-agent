const FormBox = ({title, children}) => {
    return ( 
        <div className="form__box">
            <div className="title">
                 <h2>{title}</h2>
            </div>
            {children}
        </div>
     );
}
 
export default FormBox;