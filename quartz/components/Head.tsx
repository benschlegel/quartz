import { FullSlug, _stripSlashes, joinSegments, pathToRoot } from "../util/path"
import { JSResourceToScriptElement } from "../util/resources"
import { QuartzComponentConstructor, QuartzComponentProps } from "./types"
import satori, { SatoriOptions } from "satori"
import * as fs from "fs"
import { ImageOptions, SocialImageOptions, getSatoriFont } from "../util/imageHelper"
import sharp from "sharp"
import { defaultImage } from "../util/socialImage"
import { unescapeHTML } from "../util/escape"

/**
 * Generates social image (OG/twitter standard) and saves it as `.webp` inside the public folder
 * @param opts options for generating image
 */
async function generateSocialImage(opts: ImageOptions, userOpts: SocialImageOptions) {
  const { cfg, description, fileName, fontsPromise, title } = opts
  const fonts = await fontsPromise

  // JSX that will be used to generate satori svg
  const imageElement = userOpts.imageStructure(cfg, userOpts, title, description, fonts)

  const svg = await satori(imageElement, {
    width: userOpts.width,
    height: userOpts.height,
    fonts: fonts,
  })

  // Convert svg directly to webp (with additional compression)
  const compressed = await sharp(Buffer.from(svg)).webp({ quality: 40 }).toBuffer()

  // Write to file system
  fs.writeFileSync(`${imageDir}/${fileName}.${extension}`, compressed)
}

const extension = "webp"
const imageDir = "public/static/social-images"

const defaultOptions: SocialImageOptions = {
  colorScheme: "lightMode",
  width: 1200,
  height: 676,
  imageStructure: defaultImage,
}

export default (() => {
  let fontsPromise: Promise<SatoriOptions["fonts"]>

  let fullOptions: SocialImageOptions
  function Head({ cfg, fileData, externalResources }: QuartzComponentProps) {
    // Initialize options if not set
    if (!fullOptions) {
      if (typeof cfg.generateSocialImages !== "boolean") {
        fullOptions = { ...defaultOptions, ...cfg.generateSocialImages }
      } else {
        fullOptions = defaultOptions
      }
    }

    // Memoize google fonts
    if (!fontsPromise) {
      fontsPromise = getSatoriFont(cfg.theme.typography.header, cfg.theme.typography.body)
    }

    const slug = fileData.filePath
    // since "/" is not a valid character in file names, replace with "-"
    const fileName = slug?.replaceAll("/", "-")
    const title = fileData.frontmatter?.title ?? "Untitled"

    // Get file description (priority: frontmatter > fileData > default)
    const fdDescription = fileData.description?.trim()
    let description = ""
    if (fdDescription) {
      description = unescapeHTML(fdDescription)
    }
    if (fileData.frontmatter?.socialDescription) {
      description = fileData.frontmatter.socialDescription
    }

    if (cfg.generateSocialImages) {
      // Generate folders for social images (if they dont exist yet)
      if (!fs.existsSync(imageDir)) {
        fs.mkdirSync(imageDir, { recursive: true })
      }

      if (fileName) {
        // Generate social image (happens async)
        generateSocialImage(
          {
            title,
            description,
            fileName,
            fileDir: imageDir,
            fileExt: extension,
            fontsPromise,
            cfg,
          },
          fullOptions,
        )
      }
    }

    const { css, js } = externalResources

    const url = new URL(`https://${cfg.baseUrl ?? "example.com"}`)
    const path = url.pathname as FullSlug
    const baseDir = fileData.slug === "404" ? path : pathToRoot(fileData.slug!)

    const iconPath = joinSegments(baseDir, "static/icon.png")

    const ogImageDefaultPath = `https://${cfg.baseUrl}/static/og-image.png`
    const ogImageGeneratedPath = `https://${cfg.baseUrl}/${imageDir.replace(
      "public/",
      "",
    )}/${fileName}.${extension}`

    // Use default og image if filePath doesnt exist (for autogenerated paths with no .md file)
    const useDefaultOgImage = fileName === undefined || !cfg.generateSocialImages

    // Path to og/social image (priority: frontmatter > generated image (if enabled) > default image)
    let ogImagePath = useDefaultOgImage ? ogImageDefaultPath : ogImageGeneratedPath

    // TODO: could be improved to support external images in the future
    // Handle aliases (socialImage, image and cover are supported to ensure obsidian publish support)
    const frontmatterImgUrl =
      fileData.frontmatter?.socialImage ??
      fileData.frontmatter?.image ??
      fileData.frontmatter?.cover
    if (frontmatterImgUrl) {
      ogImagePath = `https://${cfg.baseUrl}/static/${frontmatterImgUrl}`
    }

    return (
      <head>
        <title>{title}</title>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        {/* OG/Twitter meta tags */}
        <meta name="og:site_name" content={cfg.pageTitle}></meta>
        <meta property="og:title" content={title} />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={title} />
        <meta name="twitter:description" content={description} />
        <meta property="og:description" content={description} />
        <meta property="og:image:type" content={`image/${extension}`} />
        <meta property="og:image:alt" content={description} />
        {/* Dont set width and height if unknown (when using custom frontmatter image) */}
        {!frontmatterImgUrl && (
          <>
            <meta property="og:image:width" content={fullOptions.width.toString()} />
            <meta property="og:image:height" content={fullOptions.height.toString()} />
            <meta property="og:width" content={fullOptions.width.toString()} />
            <meta property="og:height" content={fullOptions.height.toString()} />
          </>
        )}
        <meta property="og:image:url" content={ogImagePath} />
        {cfg.baseUrl && (
          <>
            <meta name="twitter:image" content={ogImagePath} />
            <meta property="og:image" content={ogImagePath} />
            <meta property="twitter:domain" content={cfg.baseUrl}></meta>
            <meta property="og:url" content={`https://${cfg.baseUrl}/${fileData.slug}`}></meta>
            <meta property="twitter:url" content={`https://${cfg.baseUrl}/${fileData.slug}`}></meta>
          </>
        )}
        <link rel="icon" href={iconPath} />
        <meta name="description" content={description} />
        <meta name="generator" content="Quartz" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" />
        {css.map((href) => (
          <link key={href} href={href} rel="stylesheet" type="text/css" spa-preserve />
        ))}
        {js
          .filter((resource) => resource.loadTime === "beforeDOMReady")
          .map((res) => JSResourceToScriptElement(res, true))}
      </head>
    )
  }

  return Head
}) satisfies QuartzComponentConstructor
