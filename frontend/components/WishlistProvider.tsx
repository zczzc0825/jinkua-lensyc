"use client";
import {createContext,useContext,useEffect,useState} from "react";
import {Product} from "@/lib/types";
type Item={product:Product;quantity:number};type Ctx={items:Item[];add:(p:Product)=>void;remove:(id:number)=>void;setQuantity:(id:number,q:number)=>void;count:number};
const WishlistContext=createContext<Ctx|null>(null);
export function WishlistProvider({children}:{children:React.ReactNode}){const[items,setItems]=useState<Item[]>([]);const[ready,setReady]=useState(false);useEffect(()=>{try{setItems(JSON.parse(localStorage.getItem("plynook_inquiry")||"[]"))}finally{setReady(true)}},[]);useEffect(()=>{if(ready)localStorage.setItem("plynook_inquiry",JSON.stringify(items))},[items,ready]);function add(product:Product){setItems(old=>{const found=old.find(x=>x.product.id===product.id);return found?old.map(x=>x.product.id===product.id?{...x,quantity:x.quantity+1}:x):[...old,{product,quantity:1}]})}return <WishlistContext.Provider value={{items,add,remove:id=>setItems(x=>x.filter(i=>i.product.id!==id)),setQuantity:(id,q)=>setItems(x=>x.map(i=>i.product.id===id?{...i,quantity:Math.max(1,q)}:i)),count:items.reduce((n,x)=>n+x.quantity,0)}}>{children}</WishlistContext.Provider>}
export function useWishlist(){const value=useContext(WishlistContext);if(!value)throw new Error("WishlistProvider missing");return value}
