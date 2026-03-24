

function StatisticBar({title,children}){
    return(
    <div className='box__statistic'>
        <div className='title'>
            <h2>{title}</h2>
        </div>
        {children}
    </div>
    )
}

export default StatisticBar