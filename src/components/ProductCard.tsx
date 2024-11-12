
function ProductCard(props: any): JSX.Element {

    const name = props.name || ""
    const displayPrice = props.displayPrice || ""
    const displayLocation = props.displayLocation || ""
    const image1x = props.image1x || ""
    const image2x = props.image2x || image1x
    const srcSet = `${image1x} 1x, ${image2x} 2x`
    const url = props.url || ""

    return (
 
        <>
            <a className='product-card' href={url}>
                <article>
                    <div >
                        <img  
                        alt={name}
                        srcSet={srcSet}
                        src={image1x}/>
                    </div>
                    <section>
                        <div>
                            <h3>
                                <h5 className="location">{displayLocation}</h5>
                                <span className="product-name">{name}</span>
                            </h3>
                        </div>
                    </section>
                    <div >
                        <span className="display-price">{displayPrice}</span>
                    </div>
                </article>
            </a>
        </>
    );
}   

export default ProductCard;