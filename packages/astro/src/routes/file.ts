import type { APIRoute, GetStaticPaths, InferGetStaticPropsType } from "astro";
import { adapter } from "virtual:fumapress/astro";
import { getPressContext } from "../runtime";
import { fileStaticPaths } from "./shared";

export const getStaticPaths = (() =>
  fileStaticPaths(getPressContext(), adapter)) satisfies GetStaticPaths;

export const GET: APIRoute<InferGetStaticPropsType<typeof getStaticPaths>> = ({ props, request }) =>
  props.GET(request, { params: props.params });
