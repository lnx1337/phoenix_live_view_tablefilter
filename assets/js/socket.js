import {Socket} from "./phoenix"
import morphdom from "morphdom"

let socket = new Socket("/socket")
window.socket = socket
socket.connect()

let setCookie = (name, value) => {
  document.cookie = `${name}=${value}`
}

let getCookie = (name) => {
  return document.cookie.replace(new RegExp(`(?:(?:^|.*;\s*)${name}\s*\=\s*([^;]*).*$)|^.*$`), "$1")
}

let serializeForm = (form) => {
  return(new URLSearchParams(new FormData(form)).toString())
}

let redirect = (toURL, flash) => {
  if(flash){ setCookie("__phoenix_flash__", flash + "; max-age=60000; path=/") }
  window.location = toURL
}

let handleClick = (el, channel) => {
  let event = el.getAttribute && el.getAttribute("phx-click")
  if(!event){ return }

  el.addEventListener("click", e => {
    e.preventDefault()
    channel.push("event", {
        type: "click",
        event: event,
        id: el.id,
        value: el.getAttribute("phx-value") || el.value
    })
  })
}

let handleKeyup = (el, channel) => {
  let event = el.getAttribute && el.getAttribute("phx-keyup")
  if(!event){ return }

  el.addEventListener("keyup", e => {
    channel.push("event", {
      type: "keyup",
      event: el.getAttribute("phx-keyup"),
      id: e.target.id,
      value: e.target.value
    })
  })
}

let isBound = false
let bind = function(channel) { if(isBound){ return }
  isBound = true

  document.querySelectorAll("form[phx-change] input").forEach(input => {
    input.addEventListener("input", e => {
      channel.push("event", {
        type: "form",
        event: input.form.getAttribute("phx-change"),
        id: e.target.id,
        value: serializeForm(input.form)
      })
    })
  })

  document.querySelectorAll("form[phx-submit]").forEach(form => {
    form.addEventListener("submit", e => {
      console.log("submit")
      e.preventDefault()
      channel.push("event", {
        type: "form",
        event: form.getAttribute("phx-submit"),
        id: e.target.id,
        value: serializeForm(form)
      })
    })
  })

  document.querySelectorAll("[phx-click]").forEach(el => handleClick(el, channel))
  document.querySelectorAll("[phx-keyup]").forEach(el => handleKeyup(el, channel))
}

let joinViewChannel = (viewPid) => { if(!viewPid){ return }
  // setCookie(location.pathname, viewPid)

  let channel = socket.channel(`views:${location.pathname}`, {view: viewPid})

  channel.on("render", ({id, html}) => {
    let focused = document.activeElement
    let focusedValue = focused.value
    let {selectionStart, selectionEnd} = focused
    let div = document.createElement("div")
    div.innerHTML = html

    morphdom(document.getElementById(id), div, {
      childrenOnly: true,
      onNodeAdded: function(el){
        handleClick(el, channel)
        handleKeyup(el, channel)
      },
      onBeforeElUpdated: function(fromEl, toEl) {
        if(fromEl === focused){
          return false
        } else {
          return true
        }
      }
    })

    focused.focus()
    if(focused.setSelectionRange){
      focused.setSelectionRange(selectionStart, selectionEnd)
    }
  })

  channel.on("redirect", ({to, flash}) => redirect(to, flash) )

  channel.join()
    .receive("ok", resp => { bind(channel) })
    .receive("error", resp => {
      if(resp.reason === "noproc"){
        channel.leave()
        console.log("session expired")
        window.location.reload()
      }
      console.log("Unable to join", resp)
    })
}

// joinViewChannel(window.viewPid || getCookie(location.pathname))
joinViewChannel(window.viewPid)

export default socket