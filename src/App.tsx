import { useEffect, useState } from 'react'
import ProductCardList from "./components/ProductCardList"
import './App.css'


const pageConfig:PageConfig = JSON.parse(document.getElementById('page-config')?.textContent || '')

interface PageConfig {
  state_abbreviation: string;
  lists: string;
}

function getLists(pageConfig: PageConfig) {
  return fetch('/wp-json/state-made/v1/product/lists?lists='+pageConfig.lists+'&state_abbreviation=' + pageConfig?.state_abbreviation)
    .then(data => data.json())
}

function App() {

  interface List {
    name: String;
    products: any[];
  }
  
  const [listsJson, setListsJson] = useState<List[]>([]);

  
  useEffect(() => {
    let mounted = true;
    getLists(pageConfig)
      .then(lists => {
        if(mounted) {
          setListsJson(lists.lists)
        }
      })
  }, [])

  return (
    <>
      
        
        {listsJson.map((list,index) => (
          
          <ProductCardList index={index} name={list.name} products={list.products} />
        ))}
    </>
  )
}

export default App
